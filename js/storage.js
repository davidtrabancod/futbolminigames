/** Local storage for the solo penalty practice record. */
class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'futbolin_kids_arena_data';
    this.data = this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.highScores ||= {};
        parsed.highScores.penaltis ||= 0;
        parsed.totalGoals ||= 0;
        return parsed;
      }
    } catch (error) {
      console.warn('LocalStorage no disponible, usando memoria temporal.', error);
    }
    return { highScores: { penaltis: 0 }, totalGoals: 0 };
  }

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn('Error al guardar en LocalStorage:', error);
    }
  }

  getHighScore(gameId) {
    return this.data.highScores?.[gameId] || 0;
  }

  setScore(gameId, score, goals = score) {
    this.data.highScores ||= {};
    const isNewRecord = score > this.getHighScore(gameId);
    if (isNewRecord) this.data.highScores[gameId] = score;
    if (gameId === 'penaltis') this.data.totalGoals = (this.data.totalGoals || 0) + goals;
    this.save();
    return isNewRecord;
  }
}

window.storageManager = new StorageManager();
