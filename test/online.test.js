const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ArenaDatabase } = require('../server/database');
const { getMatchProgress, resolvePenalty } = require('../server/penalty-rules');

test('same zone is saved and different zones score', () => {
  assert.equal(resolvePenalty('top-left', 'top-left'), 'saved');
  assert.equal(resolvePenalty('top-left', 'bottom-left'), 'goal');
  assert.throws(() => resolvePenalty('invalid', 'center'), /no válida/);
});

test('regulation ends only after each player has taken three penalties', () => {
  assert.deepEqual(
    getMatchProgress({ shots: [3, 3], scores: [2, 1] }),
    { suddenDeath: false, winnerIndex: 0 }
  );
  assert.deepEqual(
    getMatchProgress({ shots: [3, 2], scores: [2, 1] }),
    { suddenDeath: false, winnerIndex: null }
  );
});

test('tied regulation continues through paired sudden-death penalties', () => {
  assert.deepEqual(
    getMatchProgress({ shots: [3, 3], scores: [2, 2] }),
    { suddenDeath: true, winnerIndex: null }
  );
  assert.deepEqual(
    getMatchProgress({ shots: [4, 3], scores: [3, 2] }),
    { suddenDeath: false, winnerIndex: null }
  );
  assert.deepEqual(
    getMatchProgress({ shots: [4, 4], scores: [3, 2] }),
    { suddenDeath: false, winnerIndex: 0 }
  );
  assert.deepEqual(
    getMatchProgress({ shots: [5, 5], scores: [3, 3] }),
    { suddenDeath: true, winnerIndex: null }
  );
});

test('ranked matches against the bot update the human rating in either outcome', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-online-test-'));
  const database = new ArenaDatabase(path.join(directory, 'arena.sqlite'));
  try {
    const player = database.createUser({
      nickname: 'JugadorUno',
      password: 'password-segura',
      avatar: '⚽'
    });
    const bot = { id: null, nickname: 'Rival CPU', avatar: '🤖', rating: 1000 };

    const win = database.saveMatch({
      id: 'bot-win',
      mode: 'ranked',
      players: [player, bot],
      scores: [3, 2],
      winnerIndex: 0,
      botIndex: 1,
      suddenDeath: false
    });
    assert.equal(win[0].delta, 24);
    assert.equal(database.getUserById(player.id).rating, 1024);

    const loss = database.saveMatch({
      id: 'bot-loss',
      mode: 'ranked',
      players: [{ ...player, rating: 1024 }, bot],
      scores: [1, 2],
      winnerIndex: 1,
      botIndex: 1,
      suddenDeath: false
    });
    assert.equal(loss[0].delta, -24);
    assert.equal(database.getUserById(player.id).rating, 1000);
  } finally {
    database.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('friendly matches update match count without changing rating', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-friendly-test-'));
  const database = new ArenaDatabase(path.join(directory, 'arena.sqlite'));
  try {
    const playerOne = database.createUser({
      nickname: 'JugadorUno',
      password: 'password-segura',
      avatar: '⚽'
    });
    const playerTwo = database.createUser({
      nickname: 'JugadorDos',
      password: 'password-segura',
      avatar: '🧤'
    });
    const result = database.saveMatch({
      id: 'friendly-match',
      mode: 'friendly',
      players: [playerOne, playerTwo],
      scores: [3, 1],
      winnerIndex: 0,
      suddenDeath: false
    });

    assert.deepEqual(result.map(entry => entry.delta), [0, 0]);
    assert.equal(database.getUserById(playerOne.id).rating, 1000);
    assert.equal(database.getUserById(playerTwo.id).rating, 1000);
    assert.equal(database.getUserById(playerOne.id).matches, 1);
  } finally {
    database.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
