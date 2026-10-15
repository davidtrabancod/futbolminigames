const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');
const { WebSocketServer, WebSocket } = require('ws');
const { ArenaDatabase, AVATARS, SESSION_DAYS, RATING_POINTS } = require('./server/database');
const { ZONES, REGULATION_SHOTS, resolvePenalty, getMatchProgress } = require('./server/penalty-rules');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.ARENA_DB_PATH || path.join(ROOT, 'data', 'arena.sqlite');
const ACTION_TIMEOUT_MS = 45_000;
const INVITE_TTL_MS = 30 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const STATIC_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.webmanifest', '.json', '.png', '.jpg', '.jpeg', '.ico', '.txt', '.xml']);
const database = new ArenaDatabase(DB_PATH);

const queue = [];
const inviteRooms = new Map();
const matches = new Map();
const clientsByUser = new Map();
const authAttempts = new Map();

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  for (const entry of cookies.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(entry.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function sessionCookie(token, secure) {
  return `arena_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(secure) {
  return `arena_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      if (tooLarge) return;
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        body = '';
      }
      if (!tooLarge) body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(Object.assign(new Error('La solicitud es demasiado grande.'), { statusCode: 413 }));
        return;
      }
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error('El cuerpo JSON no es válido.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function checkSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Object.assign(new Error('Origen no válido.'), { statusCode: 403 });
  }
  if (originHost !== req.headers.host) {
    throw Object.assign(new Error('Origen no permitido.'), { statusCode: 403 });
  }
}

function consumeAuthAttempt(req) {
  const address = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (authAttempts.get(address) || []).filter(timestamp => now - timestamp < 15 * 60 * 1000);
  if (recent.length >= 12) {
    authAttempts.set(address, recent);
    throw Object.assign(new Error('Demasiados intentos. Espera unos minutos y vuelve a probar.'), { statusCode: 429 });
  }
  recent.push(now);
  authAttempts.set(address, recent);
}

function staticFilePath(urlPath) {
  if (urlPath === '/') urlPath = '/index.html';
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  const segments = normalized.split(/[\\/]/);
  if (segments.some(segment => !segment || segment.startsWith('.') || ['data', 'server', 'node_modules'].includes(segment.toLowerCase()))) {
    return null;
  }
  const filePath = path.resolve(ROOT, normalized || 'index.html');
  if (!filePath.startsWith(`${ROOT}${path.sep}`) || !STATIC_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return null;
  }
  return filePath;
}

function mimeType(filePath) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8'
  })[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendSocket(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function sendToMatch(match, payload) {
  match.connections.forEach(ws => sendSocket(ws, payload));
}

function createInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(crypto.randomBytes(6), byte => alphabet[byte % alphabet.length]).join('');
  } while (inviteRooms.has(code));
  return code;
}

function removeFromQueue(ws) {
  const index = queue.findIndex(entry => entry.ws === ws);
  if (index >= 0) {
    clearTimeout(queue[index].timer);
    queue.splice(index, 1);
  }
}

function removeInviteFor(ws) {
  for (const [code, room] of inviteRooms) {
    if (room.hostWs === ws) {
      clearTimeout(room.timer);
      inviteRooms.delete(code);
    }
  }
}

function userForMatch(user) {
  return { id: user.id, nickname: user.nickname, avatar: user.avatar, keeperId: user.keeperId || user.keeper_id || 'rookie', rating: user.rating, rank: user.rank, wins: user.wins, matches: user.matches, isGuest: Boolean(user.is_guest || user.isGuest) };
}

function createMatch({ players, mode, botIndex = null }) {
  const id = crypto.randomUUID();
  const match = {
    id,
    mode,
    players,
    botIndex,
    connections: players.map(player => clientsByUser.get(player.id)),
    scores: [0, 0],
    shots: [0, 0],
    nextShooter: 0,
    suddenDeath: false,
    turnActions: { shot: null, save: null },
    turnTimer: null,
    botTimer: null,
    ended: false,
    history: []
  };
  matches.set(id, match);
  match.connections.forEach((ws, index) => {
    if (ws) ws.matchId = id;
  });
  publishMatchStart(match);
  return match;
}

function publishMatchStart(match) {
  const players = match.players.map(userForMatch);
  match.connections.forEach((ws, index) => {
    if (!ws) return;
    sendSocket(ws, {
      type: 'match-start',
      matchId: match.id,
      mode: match.mode,
      playerIndex: index,
      you: players[index],
      opponent: players[1 - index],
      shots: match.shots,
      scores: match.scores,
      regulationShots: REGULATION_SHOTS,
      ratingPoints: match.mode === 'ranked' && !match.players.some(player => player.is_guest) ? RATING_POINTS : 0,
      suddenDeath: false
    });
  });
  startTurn(match);
}

function startTurn(match) {
  if (match.ended) return;
  match.turnActions = { shot: null, save: null };
  const shooterIndex = match.nextShooter;
  const keeperIndex = 1 - shooterIndex;
  const prompt = {
    type: 'turn',
    shooterIndex,
    shooter: userForMatch(match.players[shooterIndex]),
    shots: match.shots,
    scores: match.scores,
    suddenDeath: match.suddenDeath,
    round: Math.min(match.shots[0], match.shots[1]) + 1,
    regulationShots: REGULATION_SHOTS
  };
  match.connections.forEach((ws, index) => {
    if (!ws) return;
    sendSocket(ws, {
      ...prompt,
      role: index === shooterIndex ? 'shooter' : 'keeper',
      message: index === shooterIndex ? 'Elige dónde lanzar.' : 'Elige dónde cubrir la portería.'
    });
  });

  match.turnTimer = setTimeout(() => {
    if (match.ended) return;
    const idleIndex = match.turnActions.shot === null ? shooterIndex : keeperIndex;
    finishMatch(match, 1 - idleIndex, 'forfeit');
  }, ACTION_TIMEOUT_MS);

  scheduleBotAction(match);

  if (match.turnActions.shot !== null && match.turnActions.save !== null) resolveTurn(match);
}

function sendMatchState(match) {
  match.connections.forEach((ws, index) => {
    if (!ws) return;
    sendSocket(ws, {
      type: 'action-progress',
      youSubmitted: index === match.nextShooter
        ? match.turnActions.shot !== null
        : match.turnActions.save !== null,
      opponentSubmitted: index === match.nextShooter
        ? match.turnActions.save !== null
        : match.turnActions.shot !== null
    });
  });
}

function handleMatchAction(ws, message) {
  const match = matches.get(ws.matchId);
  if (!match || match.ended) return;
  const actorIndex = match.players.findIndex(player => player.id === ws.arenaUser.id);
  if (actorIndex < 0) return;
  if (!ZONES.includes(message.zone)) {
    sendSocket(ws, { type: 'error', message: 'Selecciona una zona válida.' });
    return;
  }
  const isShooter = actorIndex === match.nextShooter;
  const role = isShooter ? 'shot' : 'save';
  if (match.turnActions[role] !== null) {
    sendSocket(ws, { type: 'error', message: 'Ya has elegido tu zona para este penalti.' });
    return;
  }
  match.turnActions[role] = message.zone;
  sendMatchState(match);
  if (match.turnActions.shot !== null && match.turnActions.save !== null) resolveTurn(match);
  else scheduleBotAction(match);
}

function scheduleBotAction(match) {
  if (match.ended || match.botIndex == null || match.botTimer) return;
  const botIsShooter = match.nextShooter === match.botIndex;
  const slot = botIsShooter ? 'shot' : 'save';
  if (match.turnActions[slot] !== null) return;
  if (!botIsShooter && match.turnActions.shot === null) return;
  match.botTimer = setTimeout(() => {
    match.botTimer = null;
    if (match.ended) return;
    const zone = botIsShooter
      ? ZONES[Math.floor(Math.random() * ZONES.length)]
      : (Math.random() < 0.27
        ? match.turnActions.shot
        : ZONES.filter(item => item !== match.turnActions.shot)[Math.floor(Math.random() * (ZONES.length - 1))]);
    match.turnActions[slot] = zone;
    sendMatchState(match);
    if (match.turnActions.shot !== null && match.turnActions.save !== null) resolveTurn(match);
  }, 650 + Math.floor(Math.random() * 700));
}

function resolveTurn(match) {
  if (match.ended || match.turnActions.shot === null || match.turnActions.save === null) return;
  clearTimeout(match.turnTimer);
  clearTimeout(match.botTimer);
  const shooterIndex = match.nextShooter;
  const keeperIndex = 1 - shooterIndex;
  const shotZone = match.turnActions.shot;
  const saveZone = match.turnActions.save;
  const result = resolvePenalty(shotZone, saveZone);
  match.shots[shooterIndex]++;
  if (result === 'goal') match.scores[shooterIndex]++;
  match.history.push({ shooterIndex, shotZone, saveZone, result });

  const progress = getMatchProgress(match);
  match.suddenDeath = progress.suddenDeath;
  sendToMatch(match, {
    type: 'shot-result',
    shooterIndex,
    shotZone,
    saveZone,
    result,
    scores: match.scores,
    shots: match.shots,
    suddenDeath: match.suddenDeath,
    nextShooter: keeperIndex
  });

  if (progress.winnerIndex !== null) {
    finishMatch(match, progress.winnerIndex, 'completed');
    return;
  }
  match.nextShooter = keeperIndex;
  startTurn(match);
}

function finishMatch(match, winnerIndex, reason) {
  if (match.ended) return;
  match.ended = true;
  clearTimeout(match.turnTimer);
  clearTimeout(match.botTimer);
  matches.delete(match.id);
  const ratings = database.saveMatch({
    id: match.id,
    mode: match.mode,
    players: match.players,
    scores: match.scores,
    winnerIndex,
    botIndex: match.botIndex,
    suddenDeath: match.suddenDeath
  });
  match.connections.forEach((ws, index) => {
    if (ws && ws.matchId === match.id) ws.matchId = null;
    if (!ws) return;
    const rating = ratings[index];
    const freshUser = database.getUserById(match.players[index].id);
    sendSocket(ws, {
      type: 'match-end',
      result: winnerIndex === null ? 'draw' : (winnerIndex === index ? 'win' : 'loss'),
      reason,
      scores: match.scores,
      opponent: userForMatch(match.players[1 - index]),
      rating: rating ? { before: rating.before, after: rating.after, delta: rating.delta } : { before: 1000, after: 1000, delta: 0 },
      user: freshUser ? database.publicUser(freshUser) : null,
      mode: match.mode
    });
  });
}

function handleSocketMessage(ws, rawData) {
  let message;
  try {
    message = JSON.parse(rawData.toString());
  } catch {
    sendSocket(ws, { type: 'error', message: 'Mensaje no válido.' });
    return;
  }
  if (!message || typeof message.type !== 'string') {
    sendSocket(ws, { type: 'error', message: 'Mensaje no válido.' });
    return;
  }

  if (message.type === 'queue-ranked') {
    if (ws.matchId || ws.queueState) return;
    const waiting = queue.findIndex(entry => entry.ws !== ws && Boolean(entry.ws.arenaUser.is_guest) === Boolean(ws.arenaUser.is_guest));
    if (waiting >= 0) {
      const opponent = queue.splice(waiting, 1)[0];
      clearTimeout(opponent.timer);
      opponent.ws.queueState = null;
      ws.queueState = null;
      sendSocket(opponent.ws, { type: 'queue-matched' });
      sendSocket(ws, { type: 'queue-matched' });
      createMatch({
        players: [opponent.ws.arenaUser, ws.arenaUser],
        mode: 'ranked'
      });
      return;
    }

    ws.queueState = 'ranked';
    sendSocket(ws, { type: 'queue-wait' });
    const entry = { ws, timer: null };
    entry.timer = setTimeout(() => {
      const index = queue.indexOf(entry);
      if (index < 0 || ws.readyState !== WebSocket.OPEN) return;
      queue.splice(index, 1);
      ws.queueState = null;
      sendSocket(ws, { type: 'queue-matched' });
      createMatch({
        players: [ws.arenaUser, {
          id: null, nickname: 'Nico_17', avatar: '🧤', keeperId: 'rookie', rating: ws.arenaUser.rating,
          rank: 0, wins: 4, matches: 11
        }],
        mode: 'ranked',
        botIndex: 1
      });
    }, 12_000);
    queue.push(entry);
    return;
  }

  if (message.type === 'create-invite') {
    if (ws.matchId || ws.queueState) return;
    removeInviteFor(ws);
    const code = createInviteCode();
    const room = { hostWs: ws, timer: null };
    room.timer = setTimeout(() => inviteRooms.delete(code), INVITE_TTL_MS);
    inviteRooms.set(code, room);
    ws.queueState = `invite:${code}`;
    sendSocket(ws, { type: 'invite-created', code, expiresInMinutes: INVITE_TTL_MS / 60000 });
    return;
  }

  if (message.type === 'join-invite') {
    const code = typeof message.code === 'string' ? message.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const room = inviteRooms.get(code);
    if (!room || room.hostWs.readyState !== WebSocket.OPEN || room.hostWs === ws) {
      sendSocket(ws, { type: 'error', message: 'El código no existe, ha caducado o no puedes unirte a tu propia invitación.' });
      return;
    }
    if (ws.matchId || ws.queueState) return;
    clearTimeout(room.timer);
    inviteRooms.delete(code);
    room.hostWs.queueState = null;
    ws.queueState = null;
    sendSocket(room.hostWs, { type: 'queue-matched' });
    sendSocket(ws, { type: 'queue-matched' });
    createMatch({ players: [room.hostWs.arenaUser, ws.arenaUser], mode: 'friendly' });
    return;
  }

  if (message.type === 'action') {
    handleMatchAction(ws, message);
    return;
  }

  if (message.type === 'cancel') {
    removeFromQueue(ws);
    removeInviteFor(ws);
    ws.queueState = null;
    sendSocket(ws, { type: 'cancelled' });
    return;
  }

  if (message.type === 'forfeit') {
    const match = matches.get(ws.matchId);
    if (!match) return;
    const playerIndex = match.players.findIndex(player => player.id === ws.arenaUser.id);
    if (playerIndex >= 0) finishMatch(match, 1 - playerIndex, 'forfeit');
    return;
  }

  sendSocket(ws, { type: 'error', message: 'Acción online no reconocida.' });
}

async function handleApi(req, res, url) {
  const secure = Boolean(req.socket.encrypted);
  const sessionToken = getCookie(req, 'arena_session');
  const user = database.getUserBySession(sessionToken);
  const method = req.method.toUpperCase();
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/me') {
    return sendJson(res, 200, { user: user ? database.publicUser(user) : null });
  }
  if (method === 'GET' && pathname === '/api/leaderboard') {
    return sendJson(res, 200, { entries: database.leaderboard(50) });
  }

  if (['POST', 'PUT', 'DELETE'].includes(method)) checkSameOrigin(req);

  if (method === 'POST' && pathname === '/api/guest') {
    if (user) return sendJson(res, 200, { user: database.publicUser(user) });
    consumeAuthAttempt(req);
    const guest = database.createGuest();
    const token = database.createSession(guest.id);
    return sendJson(res, 201, { user: database.publicUser(guest) }, { 'Set-Cookie': sessionCookie(token, secure) });
  }

  if (method === 'POST' && pathname === '/api/register') {
    consumeAuthAttempt(req);
    const body = await readJsonBody(req);
    const newUser = database.createUser(body);
    const token = database.createSession(newUser.id);
    return sendJson(res, 201, { user: database.publicUser(newUser) }, { 'Set-Cookie': sessionCookie(token, secure) });
  }
  if (method === 'POST' && pathname === '/api/login') {
    consumeAuthAttempt(req);
    const body = await readJsonBody(req);
    const authenticatedUser = database.authenticate(body);
    const token = database.createSession(authenticatedUser.id);
    return sendJson(res, 200, { user: database.publicUser(authenticatedUser) }, { 'Set-Cookie': sessionCookie(token, secure) });
  }
  if (method === 'POST' && pathname === '/api/logout') {
    database.deleteSession(sessionToken);
    return sendJson(res, 200, { user: null }, { 'Set-Cookie': clearSessionCookie(secure) });
  }
  if (method === 'PUT' && pathname === '/api/profile') {
    if (!user || user.is_guest) return sendJson(res, 401, { error: 'Crea una cuenta para editar tu perfil.' });
    const body = await readJsonBody(req);
    const updated = database.updateProfile(user.id, body);
    return sendJson(res, 200, { user: database.publicUser(updated) });
  }
  if (method === 'PUT' && pathname === '/api/goalkeeper') {
    if (!user || user.is_guest) return sendJson(res, 401, { error: 'Crea una cuenta para elegir tu portero.' });
    const body = await readJsonBody(req);
    const updated = database.updateGoalkeeper(user.id, body.keeperId);
    return sendJson(res, 200, { user: database.publicUser(updated) });
  }
  return sendJson(res, 404, { error: 'Ruta API no encontrada.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    const filePath = staticFilePath(url.pathname);
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end('Archivo no encontrado');
      return;
    }
    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Archivo no encontrado');
        return;
      }
      res.writeHead(200, {
        'Content-Type': mimeType(filePath),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin'
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error('Error al procesar solicitud:', error);
    if (!res.headersSent) sendJson(res, statusCode, { error: error.message || 'No se pudo completar la solicitud.' });
    else res.destroy(error);
  }
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    const user = database.getUserBySession(getCookie(req, 'arena_session'));
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(req, socket, head, ws => {
      ws.arenaUser = user;
      const oldSocket = clientsByUser.get(user.id);
      if (oldSocket && oldSocket !== ws) {
        removeFromQueue(oldSocket);
        removeInviteFor(oldSocket);
        const activeMatch = matches.get(oldSocket.matchId);
        if (activeMatch) {
          const playerIndex = activeMatch.players.findIndex(player => player.id === user.id);
          if (playerIndex >= 0) finishMatch(activeMatch, 1 - playerIndex, 'disconnect');
        }
        sendSocket(oldSocket, { type: 'error', message: 'Tu cuenta se conectó desde otra pestaña.' });
        oldSocket.close(4001, 'Replaced by a new connection');
      }
      clientsByUser.set(user.id, ws);
      sendSocket(ws, { type: 'connected', user: database.publicUser(user) });
      ws.on('message', data => handleSocketMessage(ws, data));
      ws.on('error', error => console.error('Error de WebSocket:', error.message));
      ws.on('close', () => {
        if (clientsByUser.get(user.id) !== ws) return;
        clientsByUser.delete(user.id);
        removeFromQueue(ws);
        removeInviteFor(ws);
        const match = matches.get(ws.matchId);
        if (match) {
          const playerIndex = match.players.findIndex(player => player.id === user.id);
          if (playerIndex >= 0) finishMatch(match, 1 - playerIndex, 'disconnect');
        }
      });
    });
  } catch (error) {
    console.error('Error al iniciar WebSocket:', error.message);
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
  }
});

function listen(port) {
  server.listen(port, () => {
    const address = `http://localhost:${port}`;
    console.log(`Futbolín Kids Arena disponible en ${address}`);
    console.log(`Base de datos SQLite: ${DB_PATH}`);
    if (process.env.ARENA_NO_BROWSER !== '1' && process.platform === 'win32') {
      exec(`start "" "${address}"`, error => {
        if (error) console.log(`Abre manualmente: ${address}`);
      });
    }
  });
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && port < 3100) {
      console.log(`Puerto ${port} ocupado; probando ${port + 1}...`);
      listen(port + 1);
    } else {
      console.error('No se pudo iniciar el servidor:', error);
      process.exitCode = 1;
    }
  });
}

function shutdown() {
  webSocketServer.clients.forEach(ws => ws.close(1001, 'Server shutting down'));
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

listen(PORT);
