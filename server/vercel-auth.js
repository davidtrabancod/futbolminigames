const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { AVATARS, SESSION_DAYS } = require('./database');
const GOALKEEPERS = require('../js/keepers');

const MAX_BODY_BYTES = 16 * 1024;
const PASSWORD_BYTES = 64;
let schemaPromise;

function appError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw appError('Falta conectar la base de datos Neon (DATABASE_URL).', 503);
  return neon(connectionString);
}

async function ensureSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nickname TEXT NOT NULL,
        nickname_key TEXT NOT NULL UNIQUE,
        avatar TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        matches INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      )`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS keeper_id TEXT NOT NULL DEFAULT 'rookie'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS win_streak INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS users_leaderboard ON users(rating DESC, wins DESC, nickname_key ASC)`;
      await sql`CREATE TABLE IF NOT EXISTS auth_attempts (
        address_hash TEXT PRIMARY KEY,
        window_started BIGINT NOT NULL,
        attempts INTEGER NOT NULL
      )`;
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function normalizeNickname(value) {
  if (typeof value !== 'string') throw appError('Escribe un nickname válido.');
  const nickname = value.normalize('NFKC').trim();
  const length = Array.from(nickname).length;
  if (length < 3 || length > 16 || !/^[\p{L}\p{N}_-]+$/u.test(nickname)) {
    throw appError('El nickname debe tener 3-16 caracteres: letras, números, guion o guion bajo.');
  }
  return nickname;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw appError('La contraseña debe tener entre 8 y 128 caracteres.');
  }
  return value;
}

function nicknameKey(nickname) {
  return nickname.normalize('NFKC').trim().toLocaleLowerCase('und');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(row, rank) {
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar,
    keeperId: row.keeper_id || 'rookie',
    rating: row.rating,
    rank,
    wins: row.wins,
    losses: row.losses,
    matches: row.matches,
    winStreak: row.win_streak || 0,
    isGuest: Boolean(row.is_guest)
  };
}

async function getPublicUser(sql, row) {
  if (!row) return null;
  if (row.is_guest) return publicUser(row, null);
  const [result] = await sql`
    SELECT COUNT(*)::INTEGER + 1 AS rank
    FROM users
    WHERE is_bot = FALSE AND is_guest = FALSE AND (rating > ${row.rating}
       OR (rating = ${row.rating} AND wins > ${row.wins})
       OR (rating = ${row.rating} AND wins = ${row.wins} AND nickname_key < ${row.nickname_key}))
  `;
  return publicUser(row, result.rank);
}

async function userFromSession(sql, token) {
  if (!token) return null;
  const [row] = await sql`
    SELECT users.* FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${hashToken(token)} AND sessions.expires_at > ${Date.now()}
  `;
  return row || null;
}

function readCookie(req, name) {
  const cookies = req.headers.cookie || '';
  for (const entry of cookies.split(';')) {
    const separator = entry.indexOf('=');
    if (separator >= 0 && entry.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(entry.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function setJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    const value = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    if (Buffer.byteLength(value) > MAX_BODY_BYTES) throw appError('La solicitud es demasiado grande.', 413);
    try { return value ? JSON.parse(value) : {}; } catch { throw appError('El cuerpo JSON no es válido.'); }
  }

  let body = '';
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > MAX_BODY_BYTES) throw appError('La solicitud es demasiado grande.', 413);
    body += chunk;
  }
  try { return body ? JSON.parse(body) : {}; } catch { throw appError('El cuerpo JSON no es válido.'); }
}

function verifySameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch { throw appError('Origen no válido.', 403); }
  if (originHost !== req.headers.host) throw appError('Origen no permitido.', 403);
}

async function consumeAuthAttempt(sql, req) {
  const address = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const addressHash = crypto.createHash('sha256').update(address).digest('hex');
  const now = Date.now();
  const [record] = await sql`
    INSERT INTO auth_attempts (address_hash, window_started, attempts)
    VALUES (${addressHash}, ${now}, 1)
    ON CONFLICT (address_hash) DO UPDATE SET
      window_started = CASE WHEN auth_attempts.window_started <= ${now - 15 * 60 * 1000} THEN ${now} ELSE auth_attempts.window_started END,
      attempts = CASE WHEN auth_attempts.window_started <= ${now - 15 * 60 * 1000} THEN 1 ELSE auth_attempts.attempts + 1 END
    RETURNING attempts
  `;
  if (record.attempts > 12) throw appError('Demasiados intentos. Espera unos minutos y vuelve a probar.', 429);
}

async function createSession(sql, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (${hashToken(token)}, ${userId}, ${now + SESSION_DAYS * 24 * 60 * 60 * 1000}, ${now})`;
  return token;
}

function sessionCookie(token, secure) {
  return `arena_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(secure) {
  return `arena_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

async function createUser(sql, body) {
  const nickname = normalizeNickname(body.nickname);
  const password = validatePassword(body.password);
  if (!AVATARS.includes(body.avatar)) throw appError('Elige uno de los avatares disponibles.');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, PASSWORD_BYTES).toString('hex');
  const now = Date.now();
  try {
    const [row] = await sql`INSERT INTO users
      (nickname, nickname_key, avatar, password_salt, password_hash, created_at, updated_at)
      VALUES (${nickname}, ${nicknameKey(nickname)}, ${body.avatar}, ${salt}, ${passwordHash}, ${now}, ${now})
      RETURNING *`;
    return row;
  } catch (error) {
    if (error.code === '23505') throw appError('Ese nickname ya está en uso.');
    throw error;
  }
}

async function authenticate(sql, body) {
  if (typeof body.nickname !== 'string' || typeof body.password !== 'string') {
    throw appError('Nickname o contraseña incorrectos.');
  }
  const [row] = await sql`SELECT * FROM users WHERE nickname_key = ${nicknameKey(body.nickname)} AND is_guest = FALSE AND is_bot = FALSE`;
  if (!row || body.password.length > 128) throw appError('Nickname o contraseña incorrectos.');
  const supplied = crypto.scryptSync(body.password, row.password_salt, PASSWORD_BYTES);
  const stored = Buffer.from(row.password_hash, 'hex');
  if (stored.length !== supplied.length || !crypto.timingSafeEqual(stored, supplied)) {
    throw appError('Nickname o contraseña incorrectos.');
  }
  return row;
}

async function updateProfile(sql, userId, body) {
  const nickname = normalizeNickname(body.nickname);
  if (!AVATARS.includes(body.avatar)) throw appError('Elige uno de los avatares disponibles.');
  try {
    const [row] = await sql`UPDATE users SET nickname = ${nickname}, nickname_key = ${nicknameKey(nickname)},
      avatar = ${body.avatar}, updated_at = ${Date.now()} WHERE id = ${userId} RETURNING *`;
    return row || null;
  } catch (error) {
    if (error.code === '23505') throw appError('Ese nickname ya está en uso.');
    throw error;
  }
}

async function updateGoalkeeper(sql, userId, body) {
  const keeper = GOALKEEPERS.byId(body.keeperId);
  if (keeper.id !== body.keeperId) throw appError('Ese portero no existe.');
  const [row] = await sql`UPDATE users SET keeper_id = ${keeper.id}, updated_at = ${Date.now()}
    WHERE id = ${userId} AND rating >= ${keeper.unlockRating} RETURNING *`;
  if (row) return row;
  const [user] = await sql`SELECT rating FROM users WHERE id = ${userId}`;
  if (!user) throw appError('No se encontró tu cuenta.', 404);
  throw appError(`Desbloquea este portero al llegar a ${keeper.unlockRating} puntos.`);
}

function createHandler(endpoint) {
  return async function handler(req, res) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const method = req.method.toUpperCase();
      const token = readCookie(req, 'arena_session');
      const secure = process.env.VERCEL === '1' || req.headers['x-forwarded-proto'] === 'https';

      if (endpoint !== 'me' && endpoint !== 'leaderboard') verifySameOrigin(req);

      if (endpoint === 'me' && method === 'GET') {
        return setJson(res, 200, { user: await getPublicUser(sql, await userFromSession(sql, token)) });
      }

      if (endpoint === 'leaderboard' && method === 'GET') {
        const entries = await sql`SELECT ROW_NUMBER() OVER (ORDER BY rating DESC, wins DESC, nickname_key ASC)::INTEGER AS rank,
          nickname, avatar, rating, wins, matches FROM users
          WHERE is_bot = FALSE AND is_guest = FALSE ORDER BY rating DESC, wins DESC, nickname_key ASC LIMIT 50`;
        return setJson(res, 200, { entries });
      }

      if (endpoint === 'register' && method === 'POST') {
        await consumeAuthAttempt(sql, req);
        const user = await createUser(sql, await readBody(req));
        const session = await createSession(sql, user.id);
        return setJson(res, 201, { user: await getPublicUser(sql, user) }, { 'Set-Cookie': sessionCookie(session, secure) });
      }

      if (endpoint === 'guest' && method === 'POST') {
        const existing = await userFromSession(sql, token);
        if (existing) return setJson(res, 200, { user: await getPublicUser(sql, existing) });
        await consumeAuthAttempt(sql, req);
        for (let attempt = 0; attempt < 5; attempt++) {
          const nickname = `Invitado_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const now = Date.now();
          try {
            const [guest] = await sql`INSERT INTO users
              (nickname, nickname_key, avatar, password_salt, password_hash, is_guest, created_at, updated_at)
              VALUES (${nickname}, ${nickname.toLowerCase()}, '⚽', ${crypto.randomBytes(16).toString('hex')}, ${crypto.randomBytes(64).toString('hex')}, TRUE, ${now}, ${now}) RETURNING *`;
            const session = await createSession(sql, guest.id);
            return setJson(res, 201, { user: await getPublicUser(sql, guest) }, { 'Set-Cookie': sessionCookie(session, secure) });
          } catch (error) {
            if (error.code !== '23505') throw error;
          }
        }
        throw appError('No se pudo crear el invitado. Inténtalo de nuevo.', 503);
      }

      if (endpoint === 'login' && method === 'POST') {
        await consumeAuthAttempt(sql, req);
        const user = await authenticate(sql, await readBody(req));
        const session = await createSession(sql, user.id);
        return setJson(res, 200, { user: await getPublicUser(sql, user) }, { 'Set-Cookie': sessionCookie(session, secure) });
      }

      if (endpoint === 'logout' && method === 'POST') {
        if (token) await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
        return setJson(res, 200, { user: null }, { 'Set-Cookie': clearSessionCookie(secure) });
      }

      if (endpoint === 'profile' && method === 'PUT') {
        const user = await userFromSession(sql, token);
        if (!user || user.is_guest) throw appError('Crea una cuenta para editar tu perfil.', 401);
        const updated = await updateProfile(sql, user.id, await readBody(req));
        return setJson(res, 200, { user: await getPublicUser(sql, updated) });
      }

      if (endpoint === 'goalkeeper' && method === 'PUT') {
        const user = await userFromSession(sql, token);
        if (!user || user.is_guest) throw appError('Crea una cuenta para elegir tu portero.', 401);
        const updated = await updateGoalkeeper(sql, user.id, await readBody(req));
        return setJson(res, 200, { user: await getPublicUser(sql, updated) });
      }

      return setJson(res, 405, { error: 'Método no permitido.' }, { Allow: endpoint === 'me' || endpoint === 'leaderboard' ? 'GET' : endpoint === 'profile' || endpoint === 'goalkeeper' ? 'PUT' : 'POST' });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error(`Vercel API (${endpoint}):`, error);
      return setJson(res, statusCode, { error: statusCode >= 500 ? 'No se pudo completar la solicitud. Comprueba la conexión de la base de datos.' : error.message });
    }
  };
}

module.exports = { createHandler };
