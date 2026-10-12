/**
 * Futbolín Kids Arena - Gestor de Almacenamiento Local (LocalStorage)
 * Gestiona récords, estadísticas, estrellas y progreso de la Gira Mundial (World Tour).
 */
class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'futbolin_kids_arena_data';
    this.data = this.load();
  }

  // Carga inicial o valores por defecto
  load() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Asegurar que existan campos del World Tour
        if (!parsed.unlockedLevels) parsed.unlockedLevels = ['tokyo'];
        if (!parsed.levelStars) parsed.levelStars = { tokyo: 0, rio: 0, munich: 0, milan: 0, madrid: 0 };
        return parsed;
      }
    } catch (e) {
      console.warn('LocalStorage no disponible, usando memoria temporal.', e);
    }

    return {
      highScores: {
        penaltis: 0,
        dominadas: 0,
        portero: 0
      },
      unlockedLevels: ['tokyo'],
      levelStars: {
        tokyo: 0,
        rio: 0,
        munich: 0,
        milan: 0,
        madrid: 0
      },
      totalGoals: 0,
      totalSaves: 0,
      totalJuggles: 0,
      starsCollected: 0
    };
  }

  // Guarda en localStorage de forma segura
  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Error al guardar en LocalStorage:', e);
    }
  }

  // Obtiene el récord de un minijuego
  getHighScore(gameId) {
    return this.data.highScores[gameId] || 0;
  }

  // Registra un nuevo récord si supera el anterior
  setScore(gameId, score, statValue = score) {
    let isNewRecord = false;
    const currentHigh = this.getHighScore(gameId);

    if (score > currentHigh) {
      this.data.highScores[gameId] = score;
      isNewRecord = true;
    }

    if (gameId === 'penaltis') this.data.totalGoals += statValue;
    if (gameId === 'dominadas') this.data.totalJuggles += score;
    if (gameId === 'portero') this.data.totalSaves += score;

    this.save();
    return isNewRecord;
  }

  // Métodos del World Tour (Gira Mundial)
  isLevelUnlocked(levelId) {
    if (!this.data.unlockedLevels) this.data.unlockedLevels = ['tokyo'];
    return this.data.unlockedLevels.includes(levelId);
  }

  unlockLevel(levelId) {
    if (!this.data.unlockedLevels) this.data.unlockedLevels = ['tokyo'];
    let isNew = false;
    if (!this.data.unlockedLevels.includes(levelId)) {
      this.data.unlockedLevels.push(levelId);
      isNew = true;
      this.save();
    }
    return isNew;
  }

  getLevelStars(levelId) {
    if (!this.data.levelStars) this.data.levelStars = {};
    return this.data.levelStars[levelId] || 0;
  }

  setLevelStars(levelId, stars) {
    if (!this.data.levelStars) this.data.levelStars = {};
    const current = this.data.levelStars[levelId] || 0;
    if (stars > current) {
      this.data.levelStars[levelId] = stars;
      this.save();
    }
  }

  // Guarda el resultado del nivel de la Gira Mundial
  saveLevelResult(levelId, goalsScored, targetGoals, nextLevelId) {
    const passed = goalsScored >= targetGoals;
    let starsEarned = 0;
    let unlockedNew = false;

    if (passed) {
      if (goalsScored >= 5) starsEarned = 3;
      else if (goalsScored >= 4) starsEarned = 2;
      else starsEarned = 1;

      this.setLevelStars(levelId, starsEarned);

      if (nextLevelId) {
        unlockedNew = this.unlockLevel(nextLevelId);
      }
    }

    return {
      passed,
      starsEarned,
      unlockedNew
    };
  }

  addStar() {
    this.data.starsCollected = (this.data.starsCollected || 0) + 1;
    this.save();
    return this.data.starsCollected;
  }

  getStars() {
    // Suma estrellas coleccionadas + estrellas del World Tour
    const tourStars = Object.values(this.data.levelStars || {}).reduce((a, b) => a + b, 0);
    return (this.data.starsCollected || 0) + tourStars;
  }
}

window.storageManager = new StorageManager();
