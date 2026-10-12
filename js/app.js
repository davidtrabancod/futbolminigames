/**
 * Futbolín Kids Arena - Controlador Principal de la Aplicación
 * Gestiona estados, bucle de renderizado a 60 FPS, escalado Retina/DPR y eventos táctiles.
 */
class App {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Resolución lógica virtual estándar (400 x 600)
    this.virtualWidth = 400;
    this.virtualHeight = 600;

    this.activeGameId = null;
    this.activeGame = null;
    this.gameState = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover'

    this.lastTime = 0;
    this.isMuted = window.soundManager.isMuted();

    // Instancias de minijuegos
    this.games = {
      penaltis: new window.PenaltisGame(this.canvas, this),
      dominadas: new window.DominadasGame(this.canvas, this),
      portero: new window.PorteroGame(this.canvas, this)
    };

    this.initDOM();
    this.initCanvasResize();
    this.initEvents();
    this.updateMenuScores();
    this.updateSoundButtonUI();

    // Iniciar bucle de animación
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initDOM() {
    // Pantallas principales
    this.menuScreen = document.getElementById('menuScreen');
    this.worldTourScreen = document.getElementById('worldTourScreen');
    this.onlineMatchScreen = document.getElementById('onlineMatchScreen');
    this.gameScreen = document.getElementById('gameScreen');
    this.worldTourResultModal = document.getElementById('worldTourResultModal');

    // Modales y Overlays
    this.pauseModal = document.getElementById('pauseModal');
    this.gameOverModal = document.getElementById('gameOverModal');
    this.howToPlayModal = document.getElementById('howToPlayModal');

    // Elementos del HUD
    this.hudScore = document.getElementById('hudScore');
    this.hudExtraLabel = document.getElementById('hudExtraLabel');
    this.hudExtraValue = document.getElementById('hudExtraValue');
    this.hudHistoryContainer = document.getElementById('hudHistoryContainer');
    this.countryMusicCredit = document.getElementById('countryMusicCredit');
    this.countryMusicSource = document.getElementById('countryMusicSource');
    this.countryMusicStatus = document.getElementById('countryMusicStatus');

    // Botones de control superior
    this.soundBtn = document.getElementById('soundBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');
    this.backToMenuBtn = document.getElementById('backToMenuBtn');
    this.pauseBtn = document.getElementById('pauseBtn');
  }

  initCanvasResize() {
    const resize = () => {
      const container = this.canvas.parentElement;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      // Tamaño de renderizado en canvas con DPR
      this.canvas.width = this.virtualWidth * dpr;
      this.canvas.height = this.virtualHeight * dpr;

      // Escalar contexto para que coincida con la resolución virtual
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.scaleFactorX = this.canvas.clientWidth / this.virtualWidth;
      this.scaleFactorY = this.canvas.clientHeight / this.virtualHeight;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();
  }

  // Transforma coordenadas de pantalla a coordenadas del Canvas virtual
  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (clientX === undefined && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (clientX === undefined && e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }

    clientX = clientX ?? 0;
    clientY = clientY ?? 0;

    const x = ((clientX - rect.left) / rect.width) * this.virtualWidth;
    const y = ((clientY - rect.top) / rect.height) * this.virtualHeight;

    return {
      x: Math.max(0, Math.min(this.virtualWidth, x)),
      y: Math.max(0, Math.min(this.virtualHeight, y))
    };
  }

  initEvents() {
    // Interacciones táctiles y de ratón unificadas con Pointer Events
    const onDown = (e) => {
      e.preventDefault();
      window.soundManager.initContext();
      if (this.gameState !== 'playing' || !this.activeGame) return;
      const coords = this.getCanvasCoords(e);
      if (this.activeGame.handlePointerDown) {
        this.activeGame.handlePointerDown(coords.x, coords.y);
      }
    };

    const onMove = (e) => {
      e.preventDefault();
      if (this.gameState !== 'playing' || !this.activeGame) return;
      const coords = this.getCanvasCoords(e);
      if (this.activeGame.handlePointerMove) {
        this.activeGame.handlePointerMove(coords.x, coords.y);
      }
    };

    const onUp = (e) => {
      e.preventDefault();
      if (this.gameState !== 'playing' || !this.activeGame) return;
      const coords = this.getCanvasCoords(e);
      if (this.activeGame.handlePointerUp) {
        this.activeGame.handlePointerUp(coords.x, coords.y);
      }
    };

    this.canvas.addEventListener('pointerdown', onDown, { passive: false });
    this.canvas.addEventListener('pointermove', onMove, { passive: false });
    this.canvas.addEventListener('pointerup', onUp, { passive: false });
    this.canvas.addEventListener('pointercancel', onUp, { passive: false });

    // Alternar sonido
    this.soundBtn.addEventListener('click', () => {
      this.isMuted = window.soundManager.toggleMute();
      this.updateSoundButtonUI();
      if (this.countryMusicStatus) this.countryMusicStatus.textContent = '';
      if (!this.isMuted) window.soundManager.playClick();
    });

    window.addEventListener('country-music-error', (event) => {
      const track = window.soundManager.getCountryMusicTrack(event.detail.countryId);
      if (this.countryMusicStatus && track) {
        this.countryMusicStatus.textContent = `No se pudo cargar «${track.title}». Comprueba tu conexión e inténtalo de nuevo.`;
      }
    });

    // Pantalla completa en móviles
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => {
        window.soundManager.playClick();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Botón de pausa en juego
    this.pauseBtn.addEventListener('click', () => {
      window.soundManager.playClick();
      this.pauseGame();
    });

    // Volver al menú desde el juego
    this.backToMenuBtn.addEventListener('click', () => {
      window.soundManager.playClick();
      this.goToMenu();
    });

    // Botones del Modal de Pausa
    document.getElementById('resumeBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      this.resumeGame();
    });

    document.getElementById('pauseQuitBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      this.goToMenu();
    });

    // Botones del Modal Game Over
    document.getElementById('playAgainBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      this.gameOverModal.classList.add('hidden');
      this.startMinigame(this.activeGameId);
    });

    document.getElementById('gameOverMenuBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      this.goToMenu();
    });

    document.getElementById('worldTourBackBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      this.goToMenu();
    });

    document.getElementById('worldTourMapBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      this.showWorldTour();
    });

    document.getElementById('worldTourContinueBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      const levelId = this.worldTourNextLevelId;
      if (levelId) {
        this.startMinigame('penaltis', levelId);
      } else {
        this.showWorldTour();
      }
    });

    document.getElementById('worldTourLevels').addEventListener('click', (e) => {
      const button = e.target.closest('[data-world-tour-level]');
      if (!button || button.disabled) return;
      window.soundManager.playClick();
      this.startMinigame('penaltis', button.dataset.worldTourLevel);
    });

    // Modal Cómo Jugar
    document.getElementById('closeHowToBtn').addEventListener('click', () => {
      window.soundManager.playClick();
      this.howToPlayModal.classList.add('hidden');
    });

    // Tarjetas de Selección de Minijuego
    document.querySelectorAll('[data-game-target]').forEach(card => {
      card.addEventListener('click', () => {
        const gameId = card.getAttribute('data-game-target');
        window.soundManager.playClick();
        if (gameId === 'penaltis') {
          this.showWorldTour();
        } else {
          this.startMinigame(gameId);
        }
      });
    });

    // Botones de Ayuda / Instrucciones de cada juego
    document.querySelectorAll('[data-help-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = btn.getAttribute('data-help-target');
        window.soundManager.playClick();
        this.showHowToPlay(gameId);
      });
    });
  }

  updateSoundButtonUI() {
    if (this.isMuted) {
      this.soundIcon.textContent = '🔇';
      this.soundBtn.setAttribute('aria-label', 'Activar sonido');
    } else {
      this.soundIcon.textContent = '🔊';
      this.soundBtn.setAttribute('aria-label', 'Silenciar sonido');
    }
  }

  updateMenuScores() {
    const pScore = window.storageManager.getHighScore('penaltis');
    const dScore = window.storageManager.getHighScore('dominadas');
    const poScore = window.storageManager.getHighScore('portero');

    const pEl = document.getElementById('badge-high-penaltis');
    const dEl = document.getElementById('badge-high-dominadas');
    const poEl = document.getElementById('badge-high-portero');

    if (pEl) pEl.textContent = pScore;
    if (dEl) dEl.textContent = dScore;
    if (poEl) poEl.textContent = poScore;

    const starsEl = document.getElementById('headerStarsCount');
    if (starsEl) starsEl.textContent = window.storageManager.getStars();
  }

  showWorldTour() {
    window.soundManager.stopCountryMusic();
    const levels = window.PenaltisGame.LEVELS;
    const levelsContainer = document.getElementById('worldTourLevels');
    const unlockedCount = levels.filter(level => window.storageManager.isLevelUnlocked(level.id)).length;

    document.getElementById('worldTourProgress').textContent =
      `${unlockedCount} de ${levels.length} destinos desbloqueados`;
    levelsContainer.replaceChildren();

    levels.forEach((level) => {
      const unlocked = window.storageManager.isLevelUnlocked(level.id);
      const stars = window.storageManager.getLevelStars(level.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.disabled = !unlocked;
      card.dataset.worldTourLevel = level.id;
      card.className = `game-card world-tour-card world-tour-card--${level.id} text-left rounded-3xl p-5 border-4 shadow-xl min-h-48 flex flex-col justify-between ${
        unlocked ? 'cursor-pointer' : 'is-locked cursor-not-allowed'
      }`;
      card.setAttribute('aria-label', `${unlocked ? 'Jugar' : 'Bloqueado'}: ${level.city}, ${level.country}`);

      const emblem = document.createElement('span');
      emblem.className = 'world-tour-card__emblem';
      emblem.setAttribute('aria-hidden', 'true');
      emblem.textContent = level.landmark;

      const header = document.createElement('span');
      header.className = 'world-tour-card__header text-xs uppercase tracking-wider font-black';
      header.textContent = `Nivel ${level.number} · ${unlocked ? 'Desbloqueado' : '🔒 Bloqueado'}`;

      const location = document.createElement('span');
      location.className = 'world-tour-card__location block text-2xl font-black text-white mt-3';
      location.textContent = `${level.flag} ${level.city}`;

      const country = document.createElement('span');
      country.className = 'world-tour-card__country block text-sm';
      country.textContent = `${level.country} · ${level.stadium}`;

      const description = document.createElement('span');
      description.className = 'world-tour-card__description block text-xs mt-3';
      description.textContent = level.description;

      const footer = document.createElement('span');
      footer.className = 'world-tour-card__stars block font-bold mt-4';
      footer.textContent = stars ? `${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '☆☆☆ · Gana para conseguir estrellas';

      card.append(emblem, header, location, country, description, footer);
      levelsContainer.appendChild(card);
    });

    this.gameState = 'world-tour';
    this.activeGame = null;
    this.activeGameId = null;
    this.menuScreen.classList.add('hidden');
    this.gameScreen.classList.add('hidden');
    this.onlineMatchScreen.classList.add('hidden');
    this.worldTourScreen.classList.remove('hidden');
    this.worldTourResultModal.classList.add('hidden');
    this.worldTourResultModal.classList.remove('flex');
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startMinigame(gameId, levelId) {
    if (!this.games[gameId]) return;
    if (gameId !== 'penaltis') window.soundManager.stopCountryMusic();

    this.activeGameId = gameId;
    this.activeGame = this.games[gameId];
    this.gameState = 'playing';

    this.menuScreen.classList.add('hidden');
    this.worldTourScreen.classList.add('hidden');
    this.onlineMatchScreen.classList.add('hidden');
    this.gameScreen.classList.remove('hidden');
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    this.worldTourResultModal.classList.add('hidden');
    this.worldTourResultModal.classList.remove('flex');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.activeGame.start(levelId);
    if (gameId === 'penaltis') {
      const countryId = this.activeGame.currentLevel.id;
      const track = window.soundManager.getCountryMusicTrack(countryId);
      this.countryMusicCredit.classList.remove('hidden');
      this.countryMusicStatus.textContent = '';
      this.countryMusicSource.href = track.sourceUrl;
      this.countryMusicSource.textContent = `${track.title} — ${track.artist} (${track.license})`;
      window.soundManager.startCountryMusic(countryId);
    } else {
      this.countryMusicCredit.classList.add('hidden');
    }
  }

  startOnlineGameSession(message) {
    this.activeGameId = 'penaltis';
    this.activeGame = this.games.penaltis;
    this.gameState = 'playing';

    // Ocultar pantallas de menú y mostrar el canvas de juego general
    this.menuScreen.classList.add('hidden');
    this.worldTourScreen.classList.add('hidden');
    this.onlineMatchScreen.classList.remove('hidden'); // Mantiene el panel superior de marcadores pero muestra el juego
    this.gameScreen.classList.remove('hidden');
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (this.activeGame.setOnlineMode) {
      this.activeGame.setOnlineMode(message, (zone) => {
        if (window.onlineArena) {
          window.onlineArena.submitZoneAction(zone);
        }
      });
    }
  }

  showWorldTourLevelResult(data) {
    const isNewRecord = window.storageManager.setScore('penaltis', data.score, data.goalsCount);
    this.updateMenuScores();
    this.worldTourNextLevelId = data.passed
      ? (data.nextLevel ? data.nextLevel.id : null)
      : data.level.id;

    document.getElementById('worldTourResultFlag').textContent = data.level.flag;
    document.getElementById('worldTourResultTitle').textContent =
      data.passed
        ? (data.nextLevel ? '¡Destino superado!' : '¡Campeón del World Tour!')
        : '¡Sigue intentándolo!';
    document.getElementById('worldTourResultSummary').textContent =
      `${data.level.city}: ${data.goalsCount}/${data.totalShots} goles · ${data.score} puntos` +
      (data.passed && data.nextLevel ? ` · ${data.nextLevel.flag} ${data.nextLevel.city} desbloqueado` : '');
    document.getElementById('worldTourResultStars').textContent =
      `${'⭐'.repeat(data.starsEarned)}${'☆'.repeat(3 - data.starsEarned)}`;
    document.getElementById('worldTourResultStars').setAttribute(
      'aria-label',
      `${data.starsEarned} estrellas conseguidas`
    );

    const continueButton = document.getElementById('worldTourContinueBtn');
    continueButton.textContent = data.passed
      ? (data.nextLevel ? `➡️ Viajar a ${data.nextLevel.city}` : '🏆 Ver el mapa')
      : '🔄 Repetir nivel';
    if (isNewRecord) {
      window.confettiEngine.burst(200, 200, 70);
    }

    this.gameState = 'tour-result';
    window.soundManager.stopCountryMusic();
    this.worldTourResultModal.classList.remove('hidden');
    this.worldTourResultModal.classList.add('flex');
  }

  updateHUD(data) {
    if (data.score !== undefined) {
      this.hudScore.textContent = data.score;
    }

    if (this.activeGameId === 'penaltis') {
      this.hudExtraLabel.textContent = 'TIRO:';
      this.hudExtraValue.textContent = data.round || '1/5';

      if (data.history && this.hudHistoryContainer) {
        this.hudHistoryContainer.innerHTML = '';
        this.hudHistoryContainer.classList.remove('hidden');
        data.history.forEach(res => {
          const dot = document.createElement('span');
          dot.className = `w-4 h-4 rounded-full inline-block ${res === 'goal' ? 'bg-green-400 border border-green-700' : 'bg-red-500 border border-red-800'}`;
          this.hudHistoryContainer.appendChild(dot);
        });
      }
    } else if (this.activeGameId === 'dominadas') {
      this.hudExtraLabel.textContent = 'RACHA:';
      this.hudExtraValue.textContent = `x${data.streak || 0}`;
      if (this.hudHistoryContainer) this.hudHistoryContainer.classList.add('hidden');
    } else if (this.activeGameId === 'portero') {
      this.hudExtraLabel.textContent = 'VIDAS:';
      const hearts = '❤️'.repeat(Math.max(0, data.lives || 0));
      this.hudExtraValue.textContent = hearts || '💀';
      if (this.hudHistoryContainer) this.hudHistoryContainer.classList.add('hidden');
    }
  }

  pauseGame() {
    if (this.gameState !== 'playing') return;
    this.gameState = 'paused';
    window.soundManager.pauseCountryMusic(true);
    this.pauseModal.classList.remove('hidden');
  }

  resumeGame() {
    if (this.gameState !== 'paused') return;
    this.gameState = 'playing';
    window.soundManager.pauseCountryMusic(false);
    this.pauseModal.classList.add('hidden');
    this.lastTime = performance.now();
  }

  showOnlineMatch() {
    window.soundManager.stopCountryMusic();
    this.gameState = 'online';
    this.activeGameId = 'penaltis';
    this.activeGame = this.games.penaltis;

    this.menuScreen.classList.add('hidden');
    this.worldTourScreen.classList.add('hidden');
    this.onlineMatchScreen.classList.add('hidden'); // Ocultar la caja flotante antigua
    this.gameScreen.classList.remove('hidden');     // Mostrar el canvas principal de juego
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showOnlineShotResultAnimation(isGoal) {
    const notification = document.createElement('div');
    notification.className = 'absolute inset-0 flex items-center justify-center z-50 pointer-events-none';
    notification.innerHTML = `
      <div class="bg-slate-900/90 border-4 ${isGoal ? 'border-emerald-500 text-emerald-400' : 'border-rose-500 text-rose-400'} text-4xl md:text-6xl font-extrabold px-8 py-4 rounded-3xl shadow-2xl animate-popup uppercase tracking-wider">
        ${isGoal ? '⚽ ¡GOLAZO!' : '🧤 ¡PARADÓN!'}
      </div>
    `;
    const targetArea = document.getElementById('onlineMatchScreen') || document.body;
    targetArea.style.position = 'relative';
    targetArea.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  goToMenu() {
    window.soundManager.stopCountryMusic();
    this.gameState = 'menu';
    this.activeGame = null;
    this.activeGameId = null;

    this.menuScreen.classList.remove('hidden');
    this.worldTourScreen.classList.add('hidden');
    this.onlineMatchScreen.classList.add('hidden');
    this.gameScreen.classList.add('hidden');
    this.worldTourResultModal.classList.add('hidden');
    this.worldTourResultModal.classList.remove('flex');
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');

    this.updateMenuScores();
  }

  showGameOver(data) {
    this.gameState = 'gameover';
    this.gameOverModal.classList.remove('hidden');

    document.getElementById('gameOverTitle').textContent = data.title;
    document.getElementById('gameOverSubtitle').textContent = data.subtitle;
    document.getElementById('gameOverScore').textContent = data.score;
    document.getElementById('gameOverHighScore').textContent = data.highScore;

    const recordBadge = document.getElementById('newRecordBadge');
    if (data.isNewRecord && data.score > 0) {
      recordBadge.classList.remove('hidden');
      window.confettiEngine.burst(200, 200, 100);
      window.soundManager.playGoal();
    } else {
      recordBadge.classList.add('hidden');
    }

    this.updateMenuScores();
  }

  showHowToPlay(gameId) {
    const titles = {
      penaltis: '⚽ ¿Cómo jugar a Penaltis Locos?',
      dominadas: '🤹 ¿Cómo jugar a Dominadas Infinitas?',
      portero: '🧤 ¿Cómo jugar a Super Portero?'
    };

    const descs = {
      penaltis: `
        <div class="space-y-3 text-left text-sm md:text-base">
          <p class="flex items-center gap-2"><strong>1. 5 Zonas de tiro:</strong> Toca directamente cualquiera de las 5 dianas (las dos escuadras ↖️↗️, las esquinas bajas ↙️↘️ o el centro 🎯) o desliza el dedo hacia ella.</p>
          <p class="flex items-center gap-2"><strong>2. Duelo táctico:</strong> El portero intentará adivinar a qué zona tiras. ¡Engáñalo o coloca el balón en las escuadras para anotar!</p>
          <p class="flex items-center gap-2"><strong>3. Tanda de 5 tiros:</strong> ¡Consigue la máxima puntuación y bate tu récord personal! 🏆</p>
        </div>
      `,
      dominadas: `
        <div class="space-y-3 text-left text-sm md:text-base">
          <p class="flex items-center gap-2"><strong>1. Toca el balón en el aire</strong> cada vez que caiga para mantenerlo flotando.</p>
          <p class="flex items-center gap-2"><strong>2. Toca en los lados</strong> para dirigir el balón hacia el centro.</p>
          <p class="flex items-center gap-2"><strong>3. ¡Atrapa las estrellas doradas!</strong> Te darán +5 puntos de bonus extra ⭐.</p>
        </div>
      `,
      portero: `
        <div class="space-y-3 text-left text-sm md:text-base">
          <p class="flex items-center gap-2"><strong>1. Arrastra los guantes</strong> para moverte por toda la portería.</p>
          <p class="flex items-center gap-2"><strong>2. Detén los balones</strong> antes de que crucen la línea de gol.</p>
          <p class="flex items-center gap-2"><strong>3. Tienes 3 vidas:</strong> ¡Cuidado con los tiros de fuego ultra rápidos! 🔥</p>
        </div>
      `
    };

    document.getElementById('howToTitle').textContent = titles[gameId] || '¿Cómo jugar?';
    document.getElementById('howToContent').innerHTML = descs[gameId] || '';
    this.howToPlayModal.classList.remove('hidden');
  }

  gameLoop(currentTime) {
    if (!this.lastTime) this.lastTime = currentTime;
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.gameState === 'playing' && this.activeGame) {
      this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);
      this.activeGame.update(dt);
      this.activeGame.render(this.ctx);
      window.confettiEngine.update();
      window.confettiEngine.render(this.ctx);
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.kidsArenaApp = new App();
  window.onlineArena = new OnlineArena(window.kidsArenaApp);
});