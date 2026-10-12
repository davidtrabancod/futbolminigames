const ZONES = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
const REGULATION_SHOTS = 3;

function resolvePenalty(shotZone, saveZone) {
  if (!ZONES.includes(shotZone) || !ZONES.includes(saveZone)) {
    throw new Error('Zona de penalti no válida.');
  }
  return shotZone === saveZone ? 'saved' : 'goal';
}

function getMatchProgress(match) {
  const balancedShots = match.shots[0] === match.shots[1];
  const completedRegulation = balancedShots && Math.min(...match.shots) >= REGULATION_SHOTS;
  const tied = match.scores[0] === match.scores[1];
  return {
    suddenDeath: completedRegulation && tied,
    winnerIndex: completedRegulation && !tied
      ? (match.scores[0] > match.scores[1] ? 0 : 1)
      : null
  };
}

function chooseBotZone(targetZone = null, accuracy = 0.42) {
  if (targetZone && Math.random() < accuracy) return targetZone;
  const options = ZONES.filter(zone => zone !== targetZone);
  return options[Math.floor(Math.random() * options.length)];
}

module.exports = { ZONES, REGULATION_SHOTS, resolvePenalty, getMatchProgress, chooseBotZone };
