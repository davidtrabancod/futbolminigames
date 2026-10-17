/**
 * Futbolín Kids Arena - Controlador Principal de la Aplicación
 * Gestiona estados, bucle de renderizado a 60 FPS, escalado Retina/DPR y eventos táctiles.
 */
class App {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Resolución lógica panorámica del campo (960 x 600)
    this.virtualWidth = 960;
    this.virtualHeight = 600;

    this.activeGameId = null;
    this.activeGame = null;
    this.gameState = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover'

    this.lastTime = 0;
    this.isMuted = window.soundManager.isMuted();

    // Motor de penaltis compartido por las partidas online
    this.games = {
      penaltis: new window.PenaltisGame(this.canvas, this)
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
    this.onlineMatchScreen = document.getElementById('onlineMatchScreen');
    this.gameScreen = document.getElementById('gameScreen');

    // Modales y Overlays
    this.pauseModal = document.getElementById('pauseModal');
    this.gameOverModal = document.getElementById('gameOverModal');

    // Elementos del HUD
    this.hudScore = document.getElementById('hudScore');
    this.hudExtraLabel = document.getElementById('hudExtraLabel');
    this.hudExtraValue = document.getElementById('hudExtraValue');
    this.hudHistoryContainer = document.getElementById('hudHistoryContainer');

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

    this.resizeCanvas = resize;
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
      if (!this.isMuted) window.soundManager.playClick();
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
      if (window.onlineArena?.matchActive) {
        window.onlineArena.refs.forfeitOnlineBtn.click();
        return;
      }
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
    const pEl = document.getElementById('badge-high-penaltis');
    if (pEl) pEl.textContent = pScore;
  }

  startMinigame(gameId) {
    if (!this.games[gameId]) return;

    this.gameScreen.classList.remove('game-screen--online-scoreboard');
    this.activeGameId = gameId;
    this.activeGame = this.games[gameId];
    this.gameState = 'playing';
    this.renderErrorLogged = false;

    this.menuScreen.classList.add('hidden');
    this.menuScreen.style.display = 'none';
    this.onlineMatchScreen.classList.add('hidden');
    this.gameScreen.classList.remove('hidden');
    this.gameScreen.style.display = 'flex';
    this.resizeCanvas?.();
    const onlineResult = document.getElementById('onlineMatchResult');
    onlineResult?.classList.add('hidden');
    if (onlineResult) onlineResult.style.display = 'none';
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    this.pauseBtn.classList.remove('hidden');
    document.getElementById('forfeitOnlineBtn')?.classList.add('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.activeGame.start();
  }

  startOnlineGameSession(message) {
    this.activeGameId = 'penaltis';
    this.activeGame = this.games.penaltis;
    this.gameState = 'playing';
    this.renderErrorLogged = false;

    // Ocultar pantallas de menú y mostrar el canvas de juego general
    this.menuScreen.classList.add('hidden');
    this.menuScreen.style.display = 'none';
    this.onlineMatchScreen.classList.add('hidden');
    this.gameScreen.classList.remove('hidden');
    this.gameScreen.style.display = 'flex';
    this.resizeCanvas?.();
    const onlineResult = document.getElementById('onlineMatchResult');
    onlineResult?.classList.add('hidden');
    if (onlineResult) onlineResult.style.display = 'none';
    document.getElementById('pauseBtn')?.classList.add('hidden');
    document.getElementById('forfeitOnlineBtn')?.classList.remove('hidden');
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
    }
  }

  pauseGame() {
    if (this.gameState !== 'playing') return;
    this.gameState = 'paused';
    this.pauseModal.classList.remove('hidden');
  }

  resumeGame() {
    if (this.gameState !== 'paused') return;
    this.gameState = 'playing';
    this.pauseModal.classList.add('hidden');
    this.lastTime = performance.now();
  }

  showOnlineMatch() {
    this.gameState = 'online';
    this.activeGameId = 'penaltis';
    this.activeGame = this.games.penaltis;

    this.menuScreen.classList.add('hidden');
    this.menuScreen.style.display = 'none';
    this.onlineMatchScreen.classList.add('hidden'); // Ocultar la caja flotante antigua
    this.gameScreen.classList.remove('hidden');     // Mostrar el canvas principal de juego
    this.gameScreen.style.display = 'flex';
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToMenu() {
    this.gameState = 'menu';
    this.activeGame = null;
    this.activeGameId = null;

    this.gameScreen.classList.remove('game-screen--online-scoreboard');
    this.menuScreen.classList.remove('hidden');
    this.menuScreen.style.removeProperty('display');
    this.onlineMatchScreen.classList.add('hidden');
    this.gameScreen.classList.add('hidden');
    this.gameScreen.style.display = 'none';
    const onlineResult = document.getElementById('onlineMatchResult');
    onlineResult?.classList.add('hidden');
    if (onlineResult) onlineResult.style.display = 'none';
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    this.pauseBtn.classList.remove('hidden');
    document.getElementById('forfeitOnlineBtn')?.classList.add('hidden');

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

  gameLoop(currentTime) {
    if (!this.lastTime) this.lastTime = currentTime;
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    try {
      if (this.gameState === 'playing' && this.activeGame) {
        this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);
        this.activeGame.update(dt);
        this.activeGame.render(this.ctx);
        window.confettiEngine.update();
        window.confettiEngine.render(this.ctx);
      }
    } catch (error) {
      // Keep the animation loop alive so a transient canvas error cannot strand
      // the player on an empty screen. The exception remains visible in DevTools.
      if (!this.renderErrorLogged) {
        this.renderErrorLogged = true;
        console.error('Error al renderizar la partida:', error);
      }
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = '#06151a';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.scale(this.canvas.width / this.virtualWidth, this.canvas.height / this.virtualHeight);
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ffe36e';
      this.ctx.font = '900 18px Barlow Condensed, sans-serif';
      this.ctx.fillText('NO SE PUDO CARGAR LA PARTIDA', this.virtualWidth / 2, 285);
      this.ctx.fillStyle = '#b8d8d4';
      this.ctx.font = '600 13px Chakra Petch, sans-serif';
      this.ctx.fillText('Pulsa MENÚ y vuelve a entrar en la partida.', this.virtualWidth / 2, 315);
      this.ctx.restore();
    } finally {
      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.kidsArenaApp = new App();
  window.onlineArena = new OnlineArena(window.kidsArenaApp);
});
