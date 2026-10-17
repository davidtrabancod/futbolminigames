const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const ACTION_TIMEOUT_MS = 45_000;
const PRESENCE_TIMEOUT_MS = 90_000;
const INVITE_TTL_MS = 30 * 60 * 1000;
const REMATCH_TTL_MS = 60 * 1000;
const ZONES = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
const MAX_BODY_BYTES = 16 * 1024;
let schemaPromise;

function apiError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw apiError('Falta conectar la base de datos Neon (DATABASE_URL).', 503);
  return neon(connectionString);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readCookie(req, name) {
  const cookies = req.headers.cookie || '';
  for (const entry of cookies.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(entry.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let body = '';
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  } else {
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw apiError('La solicitud es demasiado grande.', 413);
    }
  }
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw apiError('La solicitud es demasiado grande.', 413);
  try { return body ? JSON.parse(body) : {}; } catch { throw apiError('El cuerpo JSON no es válido.'); }
}

function verifySameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try { host = new URL(origin).host; } catch { throw apiError('Origen no válido.', 403); }
  if (host !== req.headers.host) throw apiError('Origen no permitido.', 403);
}

function setJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin'
  });
  res.end(JSON.stringify(payload));
}

async function ensureSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS online_matches (
        id TEXT PRIMARY KEY,
        invite_code TEXT UNIQUE,
        mode TEXT NOT NULL CHECK (mode IN ('ranked', 'friendly')),
        state TEXT NOT NULL CHECK (state IN ('waiting', 'active', 'finished', 'cancelled', 'expired')),
        player_one INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player_two INTEGER REFERENCES users(id) ON DELETE CASCADE,
        scores INTEGER[] NOT NULL DEFAULT ARRAY[0, 0],
        shots INTEGER[] NOT NULL DEFAULT ARRAY[0, 0],
        next_shooter INTEGER NOT NULL DEFAULT 0,
        sudden_death BOOLEAN NOT NULL DEFAULT FALSE,
        shot_zone TEXT,
        save_zone TEXT,
        winner_index INTEGER,
        finish_reason TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        turn_started_at BIGINT,
        expires_at BIGINT
      )`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS keeper_id TEXT NOT NULL DEFAULT 'rookie'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS win_streak INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE`;
      const botSalt = crypto.randomBytes(16).toString('hex');
      const botHash = crypto.randomBytes(48).toString('hex');
      const schemaNow = Date.now();
      await sql`INSERT INTO users(nickname, nickname_key, avatar, password_salt, password_hash, rating, wins, losses, matches, keeper_id, created_at, updated_at, is_bot)
        VALUES ('Nico_17', 'arena_bot_nico_17', '🧤', ${botSalt}, ${botHash}, 1000, 4, 7, 11, 'rookie', ${schemaNow}, ${schemaNow}, TRUE)
        ON CONFLICT (nickname_key) DO NOTHING`;
      await sql`CREATE INDEX IF NOT EXISTS online_matches_players_state ON online_matches(player_one, player_two, state)`;
      await sql`CREATE TABLE IF NOT EXISTS online_queue (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        created_at BIGINT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS online_match_presence (
        match_id TEXT NOT NULL REFERENCES online_matches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_seen BIGINT NOT NULL,
        PRIMARY KEY (match_id, user_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS online_match_events (
        event_id BIGSERIAL PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES online_matches(id) ON DELETE CASCADE,
        recipient_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at BIGINT NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS online_match_events_delivery ON online_match_events(match_id, recipient_user_id, event_id)`;
      await sql`CREATE TABLE IF NOT EXISTS online_match_rematches (
        original_match_id TEXT NOT NULL REFERENCES online_matches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_at BIGINT NOT NULL,
        rematch_match_id TEXT REFERENCES online_matches(id) ON DELETE SET NULL,
        PRIMARY KEY (original_match_id, user_id)
      )`;

      await sql`CREATE OR REPLACE FUNCTION arena_public_user(p_user_id INTEGER) RETURNS JSONB
        LANGUAGE SQL STABLE AS $function$
          SELECT jsonb_build_object(
            'id', u.id, 'nickname', u.nickname, 'avatar', u.avatar, 'keeperId', u.keeper_id,
            'rating', u.rating, 'rank', (CASE WHEN u.is_guest THEN NULL ELSE (
              SELECT COUNT(*)::INTEGER + 1 FROM users better
              WHERE better.is_bot = FALSE AND better.is_guest = FALSE AND (better.rating > u.rating
                 OR (better.rating = u.rating AND better.wins > u.wins)
                 OR (better.rating = u.rating AND better.wins = u.wins AND better.nickname_key < u.nickname_key))
            ) END),
            'wins', u.wins, 'losses', u.losses, 'matches', u.matches, 'winStreak', u.win_streak,
            'isGuest', u.is_guest
          ) FROM users u WHERE u.id = p_user_id
        $function$`;

      await sql`CREATE OR REPLACE FUNCTION arena_start_match(p_match_id TEXT) RETURNS VOID
        LANGUAGE plpgsql AS $function$
        DECLARE m online_matches%ROWTYPE; i INTEGER; me_id INTEGER; other_id INTEGER;
        BEGIN
          SELECT * INTO m FROM online_matches WHERE id = p_match_id FOR UPDATE;
          IF NOT FOUND OR m.player_two IS NULL OR m.state <> 'waiting' THEN RETURN; END IF;
          UPDATE online_matches SET state = 'active', updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT,
            turn_started_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT WHERE id = p_match_id;
          INSERT INTO online_match_presence(match_id, user_id, last_seen)
            VALUES (p_match_id, m.player_one, (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT),
                   (p_match_id, m.player_two, (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT)
            ON CONFLICT (match_id, user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen;
          FOR i IN 0..1 LOOP
            me_id := CASE WHEN i = 0 THEN m.player_one ELSE m.player_two END;
            other_id := CASE WHEN i = 0 THEN m.player_two ELSE m.player_one END;
            INSERT INTO online_match_events(match_id, recipient_user_id, event_type, payload, created_at)
            VALUES (p_match_id, me_id, 'match-start', jsonb_build_object(
              'type', 'match-start', 'matchId', p_match_id, 'mode', m.mode, 'playerIndex', i,
              'you', arena_public_user(me_id), 'opponent', arena_public_user(other_id),
              'scores', to_jsonb(m.scores), 'shots', to_jsonb(m.shots),
              'regulationShots', 3, 'ratingPoints', CASE WHEN m.mode = 'ranked' AND NOT EXISTS
                (SELECT 1 FROM users participant WHERE participant.id IN (m.player_one, m.player_two) AND participant.is_guest)
                THEN 24 + LEAST(COALESCE((SELECT win_streak FROM users WHERE id = me_id), 0) * 2, 12)
                ELSE 0 END
            ), (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT);
            INSERT INTO online_match_events(match_id, recipient_user_id, event_type, payload, created_at)
            VALUES (p_match_id, me_id, 'turn', jsonb_build_object(
              'type', 'turn', 'shooterIndex', 0, 'shooter', arena_public_user(m.player_one),
              'shots', to_jsonb(m.shots), 'scores', to_jsonb(m.scores), 'suddenDeath', FALSE,
              'round', 1, 'regulationShots', 3, 'role', CASE WHEN i = 0 THEN 'shooter' ELSE 'goalkeeper' END,
              'message', CASE WHEN i = 0 THEN 'Elige dónde lanzar.' ELSE 'Elige dónde cubrir la portería.' END
            ), (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT);
          END LOOP;
        END
        $function$`;

      await sql`CREATE OR REPLACE FUNCTION arena_request_friendly_rematch(p_original_id TEXT, p_new_id TEXT, p_user_id INTEGER) RETURNS JSONB
        LANGUAGE plpgsql AS $function$
        DECLARE m online_matches%ROWTYPE; existing_rematch_id TEXT; request_count INTEGER; now_ms BIGINT;
        BEGIN
          SELECT * INTO m FROM online_matches WHERE id = p_original_id FOR UPDATE;
          IF NOT FOUND OR m.mode <> 'friendly' OR m.state <> 'finished' THEN
            RETURN jsonb_build_object('error', 'La partida amistosa ya no está disponible para revancha.');
          END IF;
          IF p_user_id NOT IN (m.player_one, m.player_two) THEN
            RETURN jsonb_build_object('error', 'No participaste en esa partida.');
          END IF;
          now_ms := (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT;
          DELETE FROM online_match_rematches WHERE original_match_id = p_original_id
            AND rematch_match_id IS NULL AND requested_at < now_ms - 60000;
          SELECT rematch_match_id INTO existing_rematch_id FROM online_match_rematches
            WHERE original_match_id = p_original_id AND user_id = p_user_id;
          IF existing_rematch_id IS NOT NULL THEN
            RETURN jsonb_build_object('status', 'matched', 'matchId', existing_rematch_id);
          END IF;
          INSERT INTO online_match_rematches(original_match_id, user_id, requested_at)
            VALUES (p_original_id, p_user_id, now_ms)
            ON CONFLICT (original_match_id, user_id) DO UPDATE SET requested_at = EXCLUDED.requested_at;
          SELECT COUNT(*) INTO request_count FROM online_match_rematches
            WHERE original_match_id = p_original_id AND rematch_match_id IS NULL
              AND requested_at >= now_ms - 60000;
          IF request_count < 2 THEN RETURN jsonb_build_object('status', 'waiting'); END IF;
          INSERT INTO online_matches(id, mode, state, player_one, player_two, created_at, updated_at)
            VALUES (p_new_id, 'friendly', 'waiting', m.player_one, m.player_two, now_ms, now_ms);
          UPDATE online_match_rematches SET rematch_match_id = p_new_id
            WHERE original_match_id = p_original_id AND requested_at >= now_ms - 60000;
          PERFORM arena_start_match(p_new_id);
          RETURN jsonb_build_object('status', 'matched', 'matchId', p_new_id);
        END
        $function$`;

      await sql`CREATE OR REPLACE FUNCTION arena_assign_bot(p_user_id INTEGER, p_match_id TEXT) RETURNS TEXT
        LANGUAGE plpgsql AS $function$
        DECLARE queued_at BIGINT; bot_id INTEGER; existing_id TEXT;
        BEGIN
          PERFORM pg_advisory_xact_lock(48127011, 1);
          SELECT id INTO existing_id FROM online_matches WHERE state IN ('waiting', 'active')
            AND (player_one = p_user_id OR player_two = p_user_id) ORDER BY created_at DESC LIMIT 1;
          IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
          SELECT created_at INTO queued_at FROM online_queue WHERE user_id = p_user_id FOR UPDATE;
          IF queued_at IS NULL OR (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT - queued_at < 15000 THEN RETURN NULL; END IF;
          SELECT id INTO bot_id FROM users WHERE is_bot = TRUE ORDER BY id LIMIT 1;
          IF bot_id IS NULL THEN RETURN NULL; END IF;
          DELETE FROM online_queue WHERE user_id = p_user_id;
          INSERT INTO online_matches(id, mode, state, player_one, player_two, created_at, updated_at)
            VALUES (p_match_id, 'ranked', 'waiting', p_user_id, bot_id,
              (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT,
              (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT);
          PERFORM arena_start_match(p_match_id);
          RETURN p_match_id;
        END
        $function$`;

      await sql`CREATE OR REPLACE FUNCTION arena_join_ranked(p_user_id INTEGER, p_match_id TEXT) RETURNS JSONB
        LANGUAGE plpgsql AS $function$
        DECLARE candidate_id INTEGER; existing_match TEXT;
        BEGIN
          PERFORM pg_advisory_xact_lock(48127011, 1);
          UPDATE online_matches SET state = 'cancelled', invite_code = NULL,
            updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT
            WHERE player_one = p_user_id AND mode = 'friendly' AND state = 'waiting';
          SELECT id INTO existing_match FROM online_matches
            WHERE state IN ('waiting', 'active') AND (player_one = p_user_id OR player_two = p_user_id)
            ORDER BY created_at DESC LIMIT 1;
          IF existing_match IS NOT NULL THEN RETURN jsonb_build_object('status', 'in-match', 'matchId', existing_match); END IF;
          DELETE FROM online_queue WHERE created_at < (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT - 600000;
          SELECT q.user_id INTO candidate_id FROM online_queue q
            JOIN users candidate ON candidate.id = q.user_id
            WHERE q.user_id <> p_user_id
              AND candidate.is_guest = (SELECT requester.is_guest FROM users requester WHERE requester.id = p_user_id)
            ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1;
          IF candidate_id IS NULL THEN
            INSERT INTO online_queue(user_id, created_at)
              VALUES (p_user_id, (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT)
              ON CONFLICT (user_id) DO NOTHING;
            RETURN jsonb_build_object('status', 'queued');
          END IF;
          DELETE FROM online_queue WHERE user_id IN (candidate_id, p_user_id);
          INSERT INTO online_matches(id, mode, state, player_one, player_two, created_at, updated_at)
            VALUES (p_match_id, 'ranked', 'waiting', candidate_id, p_user_id,
              (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT,
              (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT);
          PERFORM arena_start_match(p_match_id);
          RETURN jsonb_build_object('status', 'matched', 'matchId', p_match_id);
        END
        $function$`;

      await sql`CREATE OR REPLACE FUNCTION arena_join_invite(p_user_id INTEGER, p_code TEXT) RETURNS JSONB
        LANGUAGE plpgsql AS $function$
        DECLARE m online_matches%ROWTYPE;
        BEGIN
          IF EXISTS (SELECT 1 FROM online_matches WHERE state = 'active'
            AND (player_one = p_user_id OR player_two = p_user_id)) THEN
            RETURN jsonb_build_object('error', 'Termina tu partida actual antes de unirte a otra.');
          END IF;
          DELETE FROM online_queue WHERE user_id = p_user_id;
          UPDATE online_matches SET state = 'cancelled', invite_code = NULL,
            updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT
            WHERE player_one = p_user_id AND mode = 'friendly' AND state = 'waiting';
          SELECT * INTO m FROM online_matches WHERE invite_code = upper(p_code) FOR UPDATE;
          IF NOT FOUND OR m.state <> 'waiting' OR m.expires_at < (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT THEN
            RETURN jsonb_build_object('error', 'Ese código no existe o la invitación ha caducado.');
          END IF;
          IF m.player_one = p_user_id THEN RETURN jsonb_build_object('error', 'No puedes unirte a tu propia invitación.'); END IF;
          UPDATE online_matches SET player_two = p_user_id, invite_code = NULL, expires_at = NULL,
            updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT WHERE id = m.id;
          PERFORM arena_start_match(m.id);
          RETURN jsonb_build_object('status', 'matched', 'matchId', m.id);
        END
        $function$`;

      await sql`CREATE OR REPLACE FUNCTION arena_finish_match(p_match_id TEXT, p_winner_index INTEGER, p_reason TEXT) RETURNS VOID
        LANGUAGE plpgsql AS $function$
        DECLARE m online_matches%ROWTYPE; ids INTEGER[]; before_ratings INTEGER[] := ARRAY[0,0]; after_ratings INTEGER[] := ARRAY[0,0];
          deltas INTEGER[] := ARRAY[0,0]; i INTEGER; user_row users%ROWTYPE; result_name TEXT; user_id INTEGER; other_id INTEGER;
          new_streak INTEGER; point_gain INTEGER;
        BEGIN
          SELECT * INTO m FROM online_matches WHERE id = p_match_id FOR UPDATE;
          IF NOT FOUND OR m.state <> 'active' THEN RETURN; END IF;
          ids := ARRAY[m.player_one, m.player_two];
          UPDATE online_matches SET state = 'finished', winner_index = p_winner_index, finish_reason = p_reason,
            updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT WHERE id = p_match_id;
          FOR i IN 1..2 LOOP
            user_id := ids[i];
            SELECT * INTO user_row FROM users WHERE id = user_id FOR UPDATE;
            before_ratings[i] := user_row.rating;
            IF m.mode = 'ranked' AND p_winner_index IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM users participant WHERE participant.id IN (m.player_one, m.player_two) AND participant.is_guest) THEN
              new_streak := CASE WHEN p_winner_index = i - 1 THEN user_row.win_streak + 1 ELSE 0 END;
              point_gain := CASE WHEN p_winner_index = i - 1 THEN 24 + LEAST((new_streak - 1) * 2, 12) ELSE -24 END;
              after_ratings[i] := GREATEST(0, user_row.rating + point_gain);
              deltas[i] := after_ratings[i] - before_ratings[i];
              UPDATE users SET rating = after_ratings[i],
                wins = wins + CASE WHEN p_winner_index = i - 1 THEN 1 ELSE 0 END,
                losses = losses + CASE WHEN p_winner_index = i - 1 THEN 0 ELSE 1 END,
                matches = matches + 1, win_streak = new_streak,
                updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT
                WHERE id = user_id;
            ELSE
              after_ratings[i] := before_ratings[i];
              UPDATE users SET matches = matches + 1,
                updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT
                WHERE id = user_id;
            END IF;
          END LOOP;
          FOR i IN 1..2 LOOP
            user_id := ids[i]; other_id := ids[3 - i];
            result_name := CASE WHEN p_winner_index IS NULL THEN 'draw' WHEN p_winner_index = i - 1 THEN 'win' ELSE 'loss' END;
            INSERT INTO online_match_events(match_id, recipient_user_id, event_type, payload, created_at)
              VALUES (p_match_id, user_id, 'match-end', jsonb_build_object(
                'type', 'match-end', 'result', result_name, 'reason', p_reason,
                'scores', to_jsonb(m.scores), 'opponent', arena_public_user(other_id), 'mode', m.mode,
                'rating', jsonb_build_object('before', before_ratings[i], 'after', after_ratings[i], 'delta', deltas[i]),
                'user', arena_public_user(user_id)
              ), (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT);
          END LOOP;
        END
        $function$`;

      await sql`CREATE OR REPLACE FUNCTION arena_submit_action(p_user_id INTEGER, p_match_id TEXT, p_zone TEXT) RETURNS JSONB
        LANGUAGE plpgsql AS $function$
        DECLARE m online_matches%ROWTYPE; player_index INTEGER; shooter_index INTEGER; keeper_index INTEGER;
          idle_index INTEGER; new_scores INTEGER[]; new_shots INTEGER[]; shot_result TEXT; winner INTEGER;
          is_complete BOOLEAN; next_sudden_death BOOLEAN; i INTEGER; user_id INTEGER; role_name TEXT;
        BEGIN
          IF NOT (p_zone = ANY(ARRAY['top-left','top-right','center','bottom-left','bottom-right'])) THEN
            RETURN jsonb_build_object('error', 'Selecciona una zona válida.');
          END IF;
          SELECT * INTO m FROM online_matches WHERE id = p_match_id FOR UPDATE;
          IF NOT FOUND OR m.state <> 'active' THEN RETURN jsonb_build_object('error', 'La partida ya no está activa.'); END IF;
          player_index := CASE WHEN m.player_one = p_user_id THEN 0 WHEN m.player_two = p_user_id THEN 1 ELSE -1 END;
          IF player_index < 0 THEN RETURN jsonb_build_object('error', 'No perteneces a esta partida.'); END IF;
          IF (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT - m.turn_started_at > 45000 THEN
            idle_index := CASE WHEN m.shot_zone IS NULL THEN m.next_shooter ELSE 1 - m.next_shooter END;
            PERFORM arena_finish_match(p_match_id, 1 - idle_index, 'forfeit');
            RETURN jsonb_build_object('status', 'finished');
          END IF;
          IF player_index = m.next_shooter THEN
            IF m.shot_zone IS NOT NULL THEN RETURN jsonb_build_object('error', 'Ya has elegido dónde lanzar.'); END IF;
            UPDATE online_matches SET shot_zone = p_zone, updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT
              WHERE id = p_match_id RETURNING * INTO m;
          ELSE
            IF m.save_zone IS NOT NULL THEN RETURN jsonb_build_object('error', 'Ya has elegido dónde parar.'); END IF;
            UPDATE online_matches SET save_zone = p_zone, updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT
              WHERE id = p_match_id RETURNING * INTO m;
          END IF;
          IF m.shot_zone IS NULL OR m.save_zone IS NULL THEN RETURN jsonb_build_object('status', 'submitted'); END IF;

          shooter_index := m.next_shooter;
          keeper_index := 1 - shooter_index;
          shot_result := CASE WHEN m.shot_zone = m.save_zone THEN 'saved' ELSE 'goal' END;
          new_scores := m.scores;
          new_shots := m.shots;
          new_shots[shooter_index + 1] := new_shots[shooter_index + 1] + 1;
          IF shot_result = 'goal' THEN new_scores[shooter_index + 1] := new_scores[shooter_index + 1] + 1; END IF;
          is_complete := new_shots[1] = new_shots[2] AND LEAST(new_shots[1], new_shots[2]) >= 3;
          winner := NULL;
          IF is_complete AND new_scores[1] <> new_scores[2] THEN
            winner := CASE WHEN new_scores[1] > new_scores[2] THEN 0 ELSE 1 END;
          END IF;
          next_sudden_death := is_complete AND new_scores[1] = new_scores[2];
          UPDATE online_matches SET scores = new_scores, shots = new_shots, sudden_death = next_sudden_death,
            updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT WHERE id = p_match_id;
          INSERT INTO online_match_events(match_id, recipient_user_id, event_type, payload, created_at)
            VALUES (p_match_id, NULL, 'shot-result', jsonb_build_object(
              'type', 'shot-result', 'shooterIndex', shooter_index, 'shooterZone', m.shot_zone,
              'keeperZone', m.save_zone, 'result', shot_result, 'scores', to_jsonb(new_scores),
              'shots', to_jsonb(new_shots), 'suddenDeath', next_sudden_death, 'nextShooter', keeper_index
            ), (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT);
          IF winner IS NOT NULL THEN
            PERFORM arena_finish_match(p_match_id, winner, 'completed');
            RETURN jsonb_build_object('status', 'finished');
          END IF;

          UPDATE online_matches SET next_shooter = keeper_index, shot_zone = NULL, save_zone = NULL,
            turn_started_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT,
            updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT WHERE id = p_match_id;
          FOR i IN 0..1 LOOP
            user_id := CASE WHEN i = 0 THEN m.player_one ELSE m.player_two END;
            role_name := CASE WHEN i = keeper_index THEN 'shooter' ELSE 'goalkeeper' END;
            INSERT INTO online_match_events(match_id, recipient_user_id, event_type, payload, created_at)
              VALUES (p_match_id, user_id, 'turn', jsonb_build_object(
                'type', 'turn', 'shooterIndex', keeper_index,
                'shooter', arena_public_user(CASE WHEN keeper_index = 0 THEN m.player_one ELSE m.player_two END),
                'shots', to_jsonb(new_shots), 'scores', to_jsonb(new_scores), 'suddenDeath', next_sudden_death,
                'round', LEAST(new_shots[1], new_shots[2]) + 1, 'regulationShots', 3, 'role', role_name,
                'message', CASE WHEN role_name = 'shooter' THEN 'Elige dónde lanzar.' ELSE 'Elige dónde cubrir la portería.' END
              ), (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT);
          END LOOP;
          RETURN jsonb_build_object('status', 'resolved');
        END
        $function$`;
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function getUserFromSession(sql, token) {
  if (!token) return null;
  const [user] = await sql`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${hashToken(token)} AND sessions.expires_at > ${Date.now()}`;
  return user || null;
}

async function handleRequest(req, res) {
  try {
    verifySameOrigin(req);
    const sql = getSql();
    await ensureSchema(sql);
    const token = readCookie(req, 'arena_session');
    const user = await getUserFromSession(sql, token);
    if (!user) throw apiError('Inicia sesión para jugar online.', 401);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return setJson(res, 405, { error: 'Método no permitido.' });
    }

    const body = await readBody(req);
    const now = Date.now();
    let payload;
    if (body.action === 'queue') {
      const [result] = await sql`SELECT arena_join_ranked(${user.id}, ${crypto.randomUUID()}) AS result`;
      payload = result.result;
    } else if (body.action === 'invite') {
      const matchId = crypto.randomUUID();
      await sql`DELETE FROM online_queue WHERE user_id = ${user.id}`;
      await sql`UPDATE online_matches SET state = 'cancelled', invite_code = NULL, updated_at = ${now}
        WHERE player_one = ${user.id} AND mode = 'friendly' AND state = 'waiting'`;
      const [activeMatch] = await sql`SELECT id FROM online_matches WHERE state = 'active'
        AND (player_one = ${user.id} OR player_two = ${user.id}) LIMIT 1`;
      if (activeMatch) throw apiError('Termina tu partida actual antes de crear otra invitaciÃ³n.', 409);
      let inviteCode;
      let created = false;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        inviteCode = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
        try {
          await sql`INSERT INTO online_matches(id, invite_code, mode, state, player_one, created_at, updated_at, expires_at)
            VALUES (${matchId}, ${inviteCode}, 'friendly', 'waiting', ${user.id}, ${now}, ${now}, ${now + INVITE_TTL_MS})`;
          created = true;
        } catch (error) {
          if (error.code !== '23505') throw error;
        }
      }
      if (!created) throw apiError('No se pudo generar un código. Inténtalo de nuevo.', 503);
      payload = { status: 'invite-created', matchId, code: inviteCode };
    } else if (body.action === 'join-invite') {
      const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (!/^[A-F0-9]{6}$/.test(code)) throw apiError('Escribe un código de invitación válido.');
      const [result] = await sql`SELECT arena_join_invite(${user.id}, ${code}) AS result`;
      payload = result.result;
    } else if (body.action === 'rematch') {
      if (typeof body.matchId !== 'string' || !body.matchId) throw apiError('No se encontró la partida anterior.');
      const [result] = await sql`SELECT arena_request_friendly_rematch(${body.matchId}, ${crypto.randomUUID()}, ${user.id}) AS result`;
      payload = result.result;
    } else if (body.action === 'rematch-poll') {
      if (typeof body.matchId !== 'string' || !body.matchId) throw apiError('No se encontró la partida anterior.');
      const [original] = await sql`SELECT player_one, player_two, mode FROM online_matches
        WHERE id = ${body.matchId} AND (player_one = ${user.id} OR player_two = ${user.id})`;
      if (!original || original.mode !== 'friendly') throw apiError('No se encontró la partida amistosa.');
      const [request] = await sql`SELECT requested_at, rematch_match_id FROM online_match_rematches
        WHERE original_match_id = ${body.matchId} AND user_id = ${user.id}`;
      if (request?.rematch_match_id) {
        payload = { status: 'matched', matchId: request.rematch_match_id };
      } else if (request && now - Number(request.requested_at) > REMATCH_TTL_MS) {
        payload = { status: 'expired' };
      } else if (request) {
        payload = { status: 'waiting' };
      } else {
        const opponentId = original.player_one === user.id ? original.player_two : original.player_one;
        const [opponentRequest] = await sql`SELECT requested_at FROM online_match_rematches
          WHERE original_match_id = ${body.matchId} AND user_id = ${opponentId}
            AND rematch_match_id IS NULL`;
        payload = opponentRequest && now - Number(opponentRequest.requested_at) <= REMATCH_TTL_MS
          ? { status: 'invited' }
          : { status: 'idle' };
      }
    } else if (body.action === 'rematch-cancel') {
      if (typeof body.matchId !== 'string' || !body.matchId) throw apiError('No se encontró la partida anterior.');
      const [request] = await sql`SELECT rematch_match_id FROM online_match_rematches
        WHERE original_match_id = ${body.matchId} AND user_id = ${user.id}`;
      if (request?.rematch_match_id) payload = { status: 'matched', matchId: request.rematch_match_id };
      else {
        await sql`DELETE FROM online_match_rematches WHERE original_match_id = ${body.matchId} AND user_id = ${user.id}`;
        payload = { status: 'cancelled' };
      }
    } else if (body.action === 'action') {
      if (typeof body.matchId !== 'string' || !ZONES.includes(body.zone)) throw apiError('La jugada no es válida.');
      const [result] = await sql`SELECT arena_submit_action(${user.id}, ${body.matchId}, ${body.zone}) AS result`;
      payload = result.result;
    } else if (body.action === 'forfeit') {
      const [match] = await sql`SELECT id, player_one, player_two FROM online_matches
        WHERE id = ${body.matchId} AND state = 'active' AND (player_one = ${user.id} OR player_two = ${user.id})`;
      if (!match) throw apiError('La partida ya no está activa.');
      const winnerIndex = match.player_one === user.id ? 1 : 0;
      await sql`SELECT arena_finish_match(${match.id}, ${winnerIndex}, 'forfeit')`;
      payload = { status: 'finished' };
    } else if (body.action === 'cancel') {
      await sql`DELETE FROM online_queue WHERE user_id = ${user.id}`;
      await sql`UPDATE online_matches SET state = 'cancelled', updated_at = ${now}
        WHERE player_one = ${user.id} AND mode = 'friendly' AND state = 'waiting'`;
      payload = { status: 'cancelled' };
    } else if (body.action === 'poll') {
      payload = await pollMatch(sql, user.id, body);
    } else {
      throw apiError('Acción de partida desconocida.');
    }

    if (payload?.error) throw apiError(payload.error, 400);
    return setJson(res, 200, payload || { status: 'ok' });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Vercel match API:', error);
    return setJson(res, status, { error: status >= 500 ? 'No se pudo conectar con el servicio de partidas.' : error.message });
  }
}

async function continueBotTurn(sql, matchId, now) {
  const [match] = await sql`SELECT m.id, m.player_one, m.player_two, m.next_shooter, m.shot_zone, m.save_zone,
      m.turn_started_at, m.state, bot.id AS bot_id
    FROM online_matches m JOIN users bot ON bot.id = m.player_two AND bot.is_bot = TRUE
    WHERE m.id = ${matchId}`;
  if (!match || match.state !== 'active' || now - Number(match.turn_started_at || now) < 700) return;

  const botIsShooter = Number(match.next_shooter) === 1;
  let zone;
  if (botIsShooter) {
    if (match.shot_zone != null) return;
    zone = ZONES[Math.floor(Math.random() * ZONES.length)];
  } else {
    if (match.shot_zone == null || match.save_zone != null) return;
    zone = Math.random() < 0.27
      ? match.shot_zone
      : ZONES.filter(candidate => candidate !== match.shot_zone)[Math.floor(Math.random() * (ZONES.length - 1))];
  }
  await sql`SELECT arena_submit_action(${match.bot_id}, ${matchId}, ${zone})`;
}

async function pollMatch(sql, userId, body) {
  let match;
  if (typeof body.matchId === 'string' && body.matchId) {
    [match] = await sql`SELECT * FROM online_matches WHERE id = ${body.matchId}
      AND (player_one = ${userId} OR player_two = ${userId})`;
    if (!match) throw apiError('No se encontró tu partida.', 404);
  } else {
    [match] = await sql`SELECT * FROM online_matches WHERE state IN ('waiting', 'active')
      AND (player_one = ${userId} OR player_two = ${userId}) ORDER BY created_at DESC LIMIT 1`;
    if (!match) {
      const [queued] = await sql`SELECT created_at FROM online_queue WHERE user_id = ${userId}`;
      if (queued && Date.now() - Number(queued.created_at) >= 15000) {
        const [assigned] = await sql`SELECT arena_assign_bot(${userId}, ${crypto.randomUUID()}) AS match_id`;
        if (assigned?.match_id) return pollMatch(sql, userId, { ...body, matchId: assigned.match_id });
      }
      return { status: queued ? 'queued' : 'idle', events: [], cursor: Number(body.cursor) || 0 };
    }
  }

  const now = Date.now();
  const playerIndex = match.player_one === userId ? 0 : 1;
  const opponentId = playerIndex === 0 ? match.player_two : match.player_one;
  if (match.state === 'waiting' && match.expires_at && Number(match.expires_at) < now) {
    await sql`UPDATE online_matches SET state = 'expired', updated_at = ${now} WHERE id = ${match.id} AND state = 'waiting'`;
    return { status: 'expired', matchId: match.id, events: [], cursor: Number(body.cursor) || 0 };
  }

  if (match.state === 'active') {
    await continueBotTurn(sql, match.id, now);
    [match] = await sql`SELECT * FROM online_matches WHERE id = ${match.id}`;
    await sql`INSERT INTO online_match_presence(match_id, user_id, last_seen) VALUES (${match.id}, ${userId}, ${now})
      ON CONFLICT (match_id, user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen`;
    const [opponentPresence] = await sql`SELECT p.last_seen, u.is_bot FROM online_match_presence p
      JOIN users u ON u.id = p.user_id WHERE p.match_id = ${match.id} AND p.user_id = ${opponentId}`;
    if (opponentPresence && !opponentPresence.is_bot && now - Number(opponentPresence.last_seen) > PRESENCE_TIMEOUT_MS) {
      await sql`SELECT arena_finish_match(${match.id}, ${playerIndex}, 'disconnect')`;
    } else if (match.turn_started_at && now - Number(match.turn_started_at) > ACTION_TIMEOUT_MS) {
      const idleIndex = match.shot_zone == null ? match.next_shooter : 1 - match.next_shooter;
      await sql`SELECT arena_finish_match(${match.id}, ${1 - idleIndex}, 'forfeit')`;
    }
  }

  const cursor = Number.isSafeInteger(Number(body.cursor)) ? Math.max(0, Number(body.cursor)) : 0;
  const events = await sql`SELECT event_id, payload FROM online_match_events
    WHERE match_id = ${match.id} AND event_id > ${cursor}
      AND (recipient_user_id IS NULL OR recipient_user_id = ${userId})
    ORDER BY event_id LIMIT 100`;
  const latestCursor = events.length ? Number(events[events.length - 1].event_id) : cursor;

  const [state] = await sql`SELECT state, scores, shots, shot_zone, save_zone, mode FROM online_matches WHERE id = ${match.id}`;
  const progress = state.state === 'active' ? {
    youSubmitted: playerIndex === match.next_shooter ? state.shot_zone != null : state.save_zone != null,
    opponentSubmitted: playerIndex === match.next_shooter ? state.save_zone != null : state.shot_zone != null
  } : null;
  return {
    status: state.state,
    matchId: match.id,
    mode: state.mode,
    code: state.state === 'waiting' && playerIndex === 0 ? match.invite_code : null,
    events: events.map(event => ({ ...event.payload, eventId: Number(event.event_id) })),
    cursor: latestCursor,
    progress,
    scores: state.scores,
    shots: state.shots
  };
}

module.exports = { createMatchHandler: () => handleRequest };
