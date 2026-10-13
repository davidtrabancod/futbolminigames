const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const GOALKEEPERS = require('../js/keepers');

const AVATARS = ['⚽', '🥅', '🧤', '🐯', '🦊', '🐼', '🦁', '🐸', '🐵', '🐧', '🐲', '⭐'];
const SESSION_DAYS = 30;
const PASSWORD_BYTES = 64;
const RATING_POINTS = 24;

function inputError(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

class ArenaDatabase {
  constructor(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        nickname TEXT NOT NULL,
        nickname_key TEXT NOT NULL UNIQUE,
        avatar TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        matches INTEGER NOT NULL DEFAULT 0,
        keeper_id TEXT NOT NULL DEFAULT 'rookie',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS users_leaderboard ON users(rating DESC, wins DESC, nickname_key ASC);
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('ranked', 'friendly')),
        player_one INTEGER NOT NULL REFERENCES users(id),
        player_two INTEGER REFERENCES users(id),
        player_two_is_bot INTEGER NOT NULL DEFAULT 0,
        score_one INTEGER NOT NULL,
        score_two INTEGER NOT NULL,
        winner INTEGER,
        rating_delta INTEGER NOT NULL DEFAULT 0,
        sudden_death INTEGER NOT NULL DEFAULT 0,
        finished_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS matches_finished_at ON matches(finished_at DESC);
    `);
    const userColumns = this.db.prepare('PRAGMA table_info(users)').all();
    if (!userColumns.some(column => column.name === 'keeper_id')) {
      this.db.exec("ALTER TABLE users ADD COLUMN keeper_id TEXT NOT NULL DEFAULT 'rookie'");
    }
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  }

  normalizeNickname(value) {
    if (typeof value !== 'string') throw inputError('Escribe un nickname válido.');
    const nickname = value.normalize('NFKC').trim();
    const length = Array.from(nickname).length;
    if (length < 3 || length > 16 || !/^[\p{L}\p{N}_-]+$/u.test(nickname)) {
      throw inputError('El nickname debe tener 3-16 caracteres: letras, números, guion o guion bajo.');
    }
    return nickname;
  }

  validatePassword(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
      throw inputError('La contraseña debe tener entre 8 y 128 caracteres.');
    }
    return value;
  }

  validateAvatar(value) {
    if (!AVATARS.includes(value)) throw inputError('Elige uno de los avatares disponibles.');
    return value;
  }

  publicUser(row) {
    const rank = this.db.prepare(`
      SELECT COUNT(*) + 1 AS rank
      FROM users
      WHERE rating > ?
         OR (rating = ? AND wins > ?)
         OR (rating = ? AND wins = ? AND nickname_key < ?)
    `).get(row.rating, row.rating, row.wins, row.rating, row.wins, row.nickname_key).rank;
    return {
      id: row.id,
      nickname: row.nickname,
      avatar: row.avatar,
      keeperId: row.keeper_id || 'rookie',
      rating: row.rating,
      rank,
      wins: row.wins,
      losses: row.losses,
      matches: row.matches
    };
  }

  getUserById(userId) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
  }

  createUser({ nickname: rawNickname, password: rawPassword, avatar: rawAvatar }) {
    const nickname = this.normalizeNickname(rawNickname);
    const password = this.validatePassword(rawPassword);
    const avatar = this.validateAvatar(rawAvatar);
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(password, salt, PASSWORD_BYTES).toString('hex');
    const now = Date.now();

    try {
      const result = this.db.prepare(`
        INSERT INTO users (nickname, nickname_key, avatar, password_salt, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(nickname, nickname.toLocaleLowerCase('und'), avatar, salt, passwordHash, now, now);
      return this.getUserById(Number(result.lastInsertRowid));
    } catch (error) {
      if (error.code === 'ERR_SQLITE_ERROR' && error.errcode === 2067) throw inputError('Ese nickname ya está en uso.');
      throw error;
    }
  }

  authenticate({ nickname: rawNickname, password: rawPassword }) {
    if (typeof rawNickname !== 'string' || typeof rawPassword !== 'string') {
      throw inputError('Nickname o contraseña incorrectos.');
    }
    const key = rawNickname.normalize('NFKC').trim().toLocaleLowerCase('und');
    const row = this.db.prepare('SELECT * FROM users WHERE nickname_key = ?').get(key);
    if (!row || rawPassword.length > 128) throw inputError('Nickname o contraseña incorrectos.');
    const supplied = crypto.scryptSync(rawPassword, row.password_salt, PASSWORD_BYTES);
    const stored = Buffer.from(row.password_hash, 'hex');
    if (stored.length !== supplied.length || !crypto.timingSafeEqual(stored, supplied)) {
      throw inputError('Nickname o contraseña incorrectos.');
    }
    return row;
  }

  updateProfile(userId, { nickname: rawNickname, avatar: rawAvatar }) {
    const nickname = this.normalizeNickname(rawNickname);
    const avatar = this.validateAvatar(rawAvatar);
    try {
      this.db.prepare('UPDATE users SET nickname = ?, nickname_key = ?, avatar = ?, updated_at = ? WHERE id = ?')
        .run(nickname, nickname.toLocaleLowerCase('und'), avatar, Date.now(), userId);
    } catch (error) {
      if (error.code === 'ERR_SQLITE_ERROR' && error.errcode === 2067) throw inputError('Ese nickname ya está en uso.');
      throw error;
    }
    return this.getUserById(userId);
  }

  updateGoalkeeper(userId, keeperId) {
    const keeper = GOALKEEPERS.byId(keeperId);
    if (keeper.id !== keeperId) throw inputError('Ese portero no existe.');
    const user = this.getUserById(userId);
    if (!user) throw inputError('No se encontró tu cuenta.');
    if (user.rating < keeper.unlockRating) throw inputError(`Desbloquea este portero al llegar a ${keeper.unlockRating} puntos.`);
    this.db.prepare('UPDATE users SET keeper_id = ?, updated_at = ? WHERE id = ?').run(keeper.id, Date.now(), userId);
    return this.getUserById(userId);
  }

  createSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(this.hashToken(token), userId, now + SESSION_DAYS * 24 * 60 * 60 * 1000, now);
    return token;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  getUserBySession(token) {
    if (!token || typeof token !== 'string') return null;
    const row = this.db.prepare(`
      SELECT users.* FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(this.hashToken(token), Date.now());
    return row ? this.publicUser(row) : null;
  }

  deleteSession(token) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(this.hashToken(token));
  }

  leaderboard(limit = 50) {
    return this.db.prepare(`
      SELECT users.* FROM users
      ORDER BY rating DESC, wins DESC, nickname_key ASC
      LIMIT ?
    `).all(limit).map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      avatar: row.avatar,
      rating: row.rating,
      wins: row.wins,
      matches: row.matches
    }));
  }

  saveMatch({ id, mode, players, scores, winnerIndex, botIndex = null, suddenDeath }) {
    const rated = mode === 'ranked';
    const playerOne = players[0].id;
    const playerTwo = botIndex === 1 ? null : players[1].id;
    let ratingResults = players.map(player => ({
      id: player.id,
      before: player.rating,
      after: player.rating,
      delta: 0
    }));

    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (rated && winnerIndex !== null) {
        ratingResults = ratingResults.map((item, index) => {
          if (index === botIndex) return item;
          const won = index === winnerIndex;
          const delta = won ? RATING_POINTS : -RATING_POINTS;
          const after = Math.max(0, item.before + delta);
          this.db.prepare(`
            UPDATE users
            SET rating = ?, wins = wins + ?, losses = losses + ?, matches = matches + 1, updated_at = ?
            WHERE id = ?
          `).run(after, won ? 1 : 0, won ? 0 : 1, Date.now(), item.id);
          return { ...item, after, delta: after - item.before };
        });
      } else if (rated && winnerIndex === null) {
        for (const player of players) {
          if (player.id !== null) {
            this.db.prepare('UPDATE users SET matches = matches + 1, updated_at = ? WHERE id = ?')
              .run(Date.now(), player.id);
          }
        }
      } else {
        for (const player of players) {
          if (player.id !== null) {
            this.db.prepare('UPDATE users SET matches = matches + 1, updated_at = ? WHERE id = ?')
              .run(Date.now(), player.id);
          }
        }
      }

      this.db.prepare(`
        INSERT INTO matches (id, mode, player_one, player_two, player_two_is_bot, score_one, score_two, winner, rating_delta, sudden_death, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        mode,
        playerOne,
        playerTwo,
        botIndex === 1 ? 1 : 0,
        scores[0],
        scores[1],
        winnerIndex === null ? null : players[winnerIndex].id,
        ratingResults[0]?.delta || 0,
        suddenDeath ? 1 : 0,
        Date.now()
      );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return ratingResults;
  }
}

module.exports = { ArenaDatabase, AVATARS, SESSION_DAYS, RATING_POINTS };
