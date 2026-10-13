/**
 * Futbolín Kids Arena - Minijuego individual: tanda de penaltis World Tour
 * Niveles progresivos en 5 países/ciudades icónicas:
 * Completa tandas en cinco ciudades y desbloquea el siguiente estadio.
 */

const WORLD_TOUR_LEVELS = [
  {
    id: 'tokyo',
    number: 1,
    city: 'Tokio',
    country: 'Japón',
    flag: '🇯🇵',
    stadium: 'Estadio Nacional',
    landmark: '🗼',
    keeperName: 'Portero de Tokio',
    keeperType: 'tokyo',
    jerseyColor: ['#166534', '#15803d'],
    shortsColor: '#0f172a',
    hasCap: true,
    capColor: '#dc2626',
    capLogo: 'W',
    hairColor: '#0f172a',
    skinColor: '#fed7aa',
    skyColors: ['#0f172a', '#1e1b4b', '#312e81'],
    ledText: 'PENALTIS ★ TOKIO ★ JAPÓN',
    targetScore: 3,
    diveSpeed: 5.2,
    reactionDelay: 0.12,
    guessRate: 0.35,
    description: 'Empieza la gira en el Estadio Nacional de Tokio.'
  },
  {
    id: 'rio',
    number: 2,
    city: 'Río de Janeiro',
    country: 'Brasil',
    flag: '🇧🇷',
    stadium: 'Estadio Maracaná',
    landmark: '⛰️',
    keeperName: 'Portero de Río',
    keeperType: 'salinas',
    jerseyColor: ['#ca8a04', '#eab308'],
    shortsColor: '#1d4ed8',
    hasCap: false,
    headbandColor: '#15803d',
    hairColor: '#1c1917',
    skinColor: '#d97706',
    skyColors: ['#1e1b4b', '#7c2d12', '#ea580c'],
    ledText: 'PENALTIS ★ RÍO DE JANEIRO ★ BRASIL',
    targetScore: 3,
    diveSpeed: 5.8,
    reactionDelay: 0.09,
    guessRate: 0.45,
    description: 'Avanza hasta el Maracaná y demuestra tu puntería.'
  },
  {
    id: 'munich',
    number: 3,
    city: 'Múnich',
    country: 'Alemania',
    flag: '🇩🇪',
    stadium: 'Olympiastadion',
    landmark: '🏰',
    keeperName: 'Portero de Múnich',
    keeperType: 'muller',
    jerseyColor: ['#1e293b', '#334155'],
    shortsColor: '#020617',
    hasCap: false,
    headbandColor: null,
    hairColor: '#facc15',
    skinColor: '#ffedd5',
    skyColors: ['#020617', '#0f172a', '#1e3a8a'],
    ledText: 'PENALTIS ★ MÚNICH ★ ALEMANIA',
    targetScore: 4,
    diveSpeed: 6.3,
    reactionDelay: 0.07,
    guessRate: 0.55,
    description: 'Supera la tanda en el Olympiastadion de Múnich.'
  },
  {
    id: 'milan',
    number: 4,
    city: 'Milán',
    country: 'Italia',
    flag: '🇮🇹',
    stadium: 'San Siro',
    landmark: '🏛️',
    keeperName: 'Portero de Milán',
    keeperType: 'gino',
    jerseyColor: ['#0369a1', '#0284c7'],
    shortsColor: '#ffffff',
    hasCap: false,
    headbandColor: null,
    hairColor: '#451a03',
    skinColor: '#fed7aa',
    skyColors: ['#090d16', '#064e3b', '#047857'],
    ledText: 'PENALTIS ★ MILÁN ★ ITALIA',
    targetScore: 4,
    diveSpeed: 6.7,
    reactionDelay: 0.05,
    guessRate: 0.65,
    description: 'Llega a San Siro y afina tus lanzamientos.'
  },
  {
    id: 'madrid',
    number: 5,
    city: 'Madrid',
    country: 'España',
    flag: '🇪🇸',
    stadium: 'Gran Final Bernabéu',
    landmark: '🏟️',
    keeperName: 'Portero de Madrid',
    keeperType: 'final',
    jerseyColor: ['#b91c1c', '#dc2626'],
    shortsColor: '#0f172a',
    hasCap: true,
    capColor: '#facc15',
    capLogo: '★',
    hairColor: '#020617',
    skinColor: '#fed7aa',
    skyColors: ['#1e1b4b', '#701a75', '#e11d48'],
    ledText: 'PENALTIS ★ MADRID ★ GRAN FINAL',
    targetScore: 4,
    diveSpeed: 7.2,
    reactionDelay: 0.04,
    guessRate: 0.75,
    description: 'Completa la gira con la tanda final en Madrid.'
  }
];

class PenaltisGame {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;

    this.vWidth = 400;
    this.vHeight = 600;

    // Las 5 Zonas de Disparo Táctico
    this.TARGET_ZONES = [
      { id: 'top-left', name: 'Escuadra Izq.', shotName: '¡TIRO CON EFECTO! 🌪️', x: 94, y: 135, icon: '↖️' },
      { id: 'top-right', name: 'Escuadra Der.', shotName: '¡TIRO DEL HALCÓN! 🦅', x: 306, y: 135, icon: '↗️' },
      { id: 'center', name: 'Centro Misil', shotName: '¡TIRO DEL TIGRE! 🐯🔥', x: 200, y: 205, icon: '🎯' },
      { id: 'bottom-left', name: 'Raso Izq.', shotName: '¡TIRO RASANTE! ⚡', x: 94, y: 255, icon: '↙️' },
      { id: 'bottom-right', name: 'Raso Der.', shotName: '¡TIRO CORTADO! 🌪️', x: 306, y: 255, icon: '↘️' }
    ];

    this.currentLevel = WORLD_TOUR_LEVELS[0];
    this.isOnlineMode = false;
    this.onlineRole = null;
    this.onOnlineActionSubmit = null;

    this.initNetMesh();

    this.auraParticles = [];
    this.speedLines = [];
    this.ballFireTrail = [];

    this.camera = {
      zoom: 1.0,
      targetZoom: 1.0,
      shake: 0
    };

    this.reset();
  }

  static get LEVELS() {
    return WORLD_TOUR_LEVELS;
  }

  setLevel(levelId) {
    const found = WORLD_TOUR_LEVELS.find(l => l.id === levelId);
    if (found) {
      this.currentLevel = found;
    }
  }

  // --- MÉTODOS ONLINE ---
  setOnlineMode(matchData, onSubmitAction) {
    this.isOnlineMode = true;
    this.onOnlineActionSubmit = onSubmitAction;

    this.onlineMyHistory = [];
    this.onlineOppHistory = [];
    this.onlineMyScore = 0;
    this.onlineOppScore = 0;
    this.state = 'aiming';

    this.reset();
  }

  setOnlineTurn(turnMessage) {
    this.onlineRole = turnMessage.role === 'shooter' ? 'lanzador' : 'portero';
    this.state = 'aiming';
    this.activeZone = null;
    this.hoverZone = null;
    this.ball.inFlight = false;
    this.ball.x = this.ball.startX;
    this.ball.y = this.ball.startY;
    this.keeper.x = this.keeper.baseX;
    this.keeper.y = this.keeper.baseY;
    this.keeper.rotation = 0;
    this.keeper.state = 'idle';
    this.keeper.diving = false;
  }

  triggerOnlineShotAnimation(shooterZoneId, keeperZoneId, turnRole, isGoal) {
    const targetZone = this.TARGET_ZONES.find(z => z.id === shooterZoneId) || this.TARGET_ZONES[2];
    this.launchAnimeShot(targetZone, keeperZoneId);
    
    setTimeout(() => {
      if (this.isOnlineMode) {
        this.resolveOnlineVisualOutcomeDirect(turnRole, isGoal);
      }
    }, 600);
  }
  // ----------------------

  initNetMesh() {
    this.netCols = 16;
    this.netRows = 10;
    this.netNodes = [];

    const gx = 60, gy = 110, gw = 280, gh = 170;
    for (let r = 0; r <= this.netRows; r++) {
      this.netNodes[r] = [];
      for (let c = 0; c <= this.netCols; c++) {
        this.netNodes[r][c] = {
          origX: gx + (c / this.netCols) * gw,
          origY: gy + (r / this.netRows) * gh,
          z: 0,
          vz: 0
        };
      }
    }
  }

  reset() {
    this.score = 0;
    this.streak = 0;
    this.shotsTaken = 0;
    this.maxShots = 5;
    this.history = [];
    this.state = 'aiming';

    this.goal = {
      x: 60,
      y: 110,
      w: 280,
      h: 170,
      postWidth: 12
    };

    const lvl = this.currentLevel;
    this.keeper = {
      x: 200,
      y: 230,
      baseX: 200,
      baseY: 230,
      targetX: 200,
      targetY: 230,
      rotation: 0,
      diving: false,
      state: 'idle',
      idleTimer: 0,
      diveZoneId: null,
      diveSpeed: lvl.diveSpeed,
      reactionDelay: lvl.reactionDelay,
      guessRate: lvl.guessRate,
      levelData: lvl
    };

    this.ball = {
      startX: 200,
      startY: 510,
      x: 200,
      y: 510,
      radius: 25,
      scale: 1.0,
      targetX: 200,
      targetY: 200,
      progress: 0,
      flightTime: 0.54,
      rotation: 0,
      inFlight: false,
      selectedZone: null,
      result: null
    };

    this.dragStart = null;
    this.dragCurrent = null;
    this.activeZone = null;
    this.hoverZone = null;

    this.feedbackTitle = '';
    this.feedbackSubtext = '';
    this.feedbackAlpha = 0;
    this.feedbackScale = 1;
    this.feedbackColor = '#facc15';

    this.camera.zoom = 1.0;
    this.camera.targetZoom = 1.0;
    this.camera.shake = 0;

    this.auraParticles = [];
    this.speedLines = [];
    this.ballFireTrail = [];
    this.initNetMesh();

    this.timer = 0;
  }

  start(levelId) {
    if (!this.isOnlineMode && levelId) this.setLevel(levelId);
    this.reset();
    window.soundManager.playWhistle();
  }

  getClosestZone(x, y) {
    let closest = null;
    let minDist = Infinity;
    for (const z of this.TARGET_ZONES) {
      const d = Math.hypot(x - z.x, y - z.y);
      if (d < minDist) {
        minDist = d;
        closest = z;
      }
    }
    return closest;
  }

  renderOnlineScoreboardOverlay(ctx) {
    ctx.save();
    
    const boxX = 12;
    const boxY = 8;
    const boxW = 376;
    const boxH = 64;
    
    // Sombra exterior profunda 3D (NO TOCAR)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    // Gradiente metálico/futurista de fondo estilo HUD (NO TOCAR)
    const bgGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    
    ctx.shadowBlur = 0;

    // Borde exterior con pulso de neón (NO TOCAR)
    const pulse = Math.sin(this.timer * 6) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Líneas divisorias (NO TOCAR)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxX + 10, boxY + 28);
    ctx.lineTo(boxX + boxW - 10, boxY + 28);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(boxX + boxW / 2, boxY + 30);
    ctx.lineTo(boxX + boxW / 2, boxY + boxH - 6);
    ctx.stroke();

    const myName = (this.onlineMyName || 'Tú').toUpperCase();
    const oppName = (this.onlineOppName || 'Rival').toUpperCase();
    const myScore = this.onlineMyScore !== undefined ? this.onlineMyScore : 0;
    const oppScore = this.onlineOppScore !== undefined ? this.onlineOppScore : 0;

    // ==========================================
    // PISO SUPERIOR: DESTELLO POR DEBAJO + NOMBRES
    // ==========================================
    const sweepProgress = (this.timer * 0.7) % 3.0; 
    const sweepX = boxX + 14 + (sweepProgress * 120);

    ctx.save();
    ctx.beginPath();
    ctx.rect(boxX + 10, boxY + 4, boxW - 20, 22);
    ctx.clip();

    ctx.globalCompositeOperation = 'lighter';

    const shimmer = ctx.createLinearGradient(sweepX - 25, 0, sweepX + 25, 0);
    shimmer.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shimmer.addColorStop(0.5, 'rgba(251, 255, 0, 0.24)');
    shimmer.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = shimmer;
    ctx.fillRect(boxX + 10, boxY + 4, boxW - 20, 22);
    ctx.restore();

    ctx.font = '900 9px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(myName, boxX + 14, boxY + 15);

    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'right';
    ctx.fillText(oppName, boxX + boxW - 14, boxY + 15);

    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.font = '900 10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VS', boxX + boxW / 2, boxY + 15);
    ctx.shadowBlur = 0;

    // ==========================================
    // PISO INFERIOR: PUNTUACIÓN Y PENALTIS (MÁXIMO 4 CÍRCULOS: 3 NORMALES + 1 EXTRA DE MUERTE SÚBITA)
    // ==========================================
    const infY = boxY + 46;

    // --- LADO IZQUIERDO (TÚ) ---
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.font = '900 50px Fredoka, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(myScore, boxX + (boxW / 2) - 18, infY);
    ctx.shadowBlur = 0;

    const myHistory = this.onlineMyHistory || [];
    const oppHistory = this.onlineOppHistory || [];
    
    // Condición exacta: Ambos han lanzado al menos 3 veces, hay empate global y las puntuaciones coinciden
    const isSuddenDeathActive = (myHistory.length >= 3 && oppHistory.length >= 3 && myScore === oppScore) || myHistory.length > 3 || oppHistory.length > 3;
    const myTotalCircles = isSuddenDeathActive ? 4 : 3;
    
    for (let i = 0; i < myTotalCircles; i++) {
      const cx = (boxX + 22) + i * 19;
      const cy = infY;
      
      ctx.beginPath();
      ctx.arc(cx, cy, 6.0, 0, Math.PI * 2);
      
      if (myHistory[i] === 'goal') {
        ctx.fillStyle = '#22c55e';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (myHistory[i] === 'saved') {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; // Vacío y listo para el desempate
        ctx.fill();
      }
      ctx.strokeStyle = i >= 3 ? '#facc15' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = i >= 3 ? 1.8 : 1.2;
      ctx.stroke();
    }

    // --- LADO DERECHO (RIVAL) ---
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#f87171';
    ctx.shadowBlur = 8;
    ctx.font = '900 50px Fredoka, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(oppScore, boxX + (boxW / 2) + 18, infY);
    ctx.shadowBlur = 0;

    const oppTotalCircles = isSuddenDeathActive ? 4 : 3;

    for (let i = 0; i < oppTotalCircles; i++) {
      const cx = (boxX + boxW - 22) - i * 19;
      const cy = infY;
      
      ctx.beginPath();
      ctx.arc(cx, cy, 6.0, 0, Math.PI * 2);
      
      if (oppHistory[i] === 'goal') {
        ctx.fillStyle = '#22c55e';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (oppHistory[i] === 'saved') {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; // Vacío y listo para el desempate
        ctx.fill();
      }
      ctx.strokeStyle = i >= 3 ? '#facc15' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = i >= 3 ? 1.8 : 1.2;
      ctx.stroke();
    }

    ctx.restore();
  }
  
  handlePointerDown(x, y) {
    if (this.state !== 'aiming') return;

    for (const z of this.TARGET_ZONES) {
      if (Math.hypot(x - z.x, y - z.y) <= 38) {
        this.selectZoneAction(z);
        return;
      }
    }

    if (!this.isOnlineMode) {
      if (Math.hypot(x - this.ball.x, y - this.ball.y) < 85 || y > 380) {
        this.dragStart = { x, y };
        this.dragCurrent = { x, y };
        this.activeZone = null;
      }
    }
  }

  handlePointerMove(x, y) {
    if (this.state !== 'aiming') return;

    if (!this.isOnlineMode && this.dragStart) {
      this.dragCurrent = { x, y };
      let projX, projY;
      if (y < 340) {
        projX = x;
        projY = y;
      } else {
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;
        projX = 200 + dx * 2.2;
        projY = 280 + dy * 1.0;
      }
      this.activeZone = this.getClosestZone(projX, projY);
    } else {
      this.hoverZone = null;
      for (const z of this.TARGET_ZONES) {
        if (Math.hypot(x - z.x, y - z.y) <= 35) {
          this.hoverZone = z;
          break;
        }
      }
    }
  }

  handlePointerUp(x, y) {
    if (!this.isOnlineMode && this.state === 'aiming' && this.dragStart) {
      const dragDist = Math.hypot(x - this.dragStart.x, y - this.dragStart.y);
      if (dragDist > 18 && this.activeZone) {
        this.selectZoneAction(this.activeZone);
      }
      this.dragStart = null;
      this.dragCurrent = null;
      this.activeZone = null;
    }
  }

  selectZoneAction(zone) {
    this.activeZone = zone;
    if (this.isOnlineMode) {
      if (typeof this.onOnlineActionSubmit === 'function') {
        this.onOnlineActionSubmit(zone.id);
      }
      return;
    }
    this.launchAnimeShot(zone);
  }

  launchAnimeShot(zone, keeperChoiceId = null) {
    this.state = 'shooting';
    this.ball.inFlight = true;
    this.ball.progress = 0;
    this.ball.targetX = zone.x;
    this.ball.targetY = zone.y;
    this.ball.selectedZone = zone;
    this.ball.result = null;

    if (window.soundManager.playAnimeShot) {
      window.soundManager.playAnimeShot();
    } else {
      window.soundManager.playKick();
    }

    this.spawnMangaSpeedLines();
    this.camera.targetZoom = 1.12;

    const lvl = this.currentLevel;
    if (!keeperChoiceId) {
      const rand = Math.random();
      if (rand < lvl.guessRate) {
        keeperChoiceId = Math.random() < 0.6 ? zone.id : (zone.id.includes('left') ? 'bottom-left' : 'bottom-right');
      } else {
        const otherZones = this.TARGET_ZONES.filter(z => z.id !== zone.id);
        keeperChoiceId = otherZones[Math.floor(Math.random() * otherZones.length)].id;
      }
    }

    const chosenZone = this.TARGET_ZONES.find(z => z.id === keeperChoiceId) || this.TARGET_ZONES[2];
    this.keeper.diveZoneId = keeperChoiceId;
    this.keeper.targetX = keeperChoiceId === 'center' ? 200 : chosenZone.x;
    this.keeper.targetY = keeperChoiceId === 'center' ? 220 : chosenZone.y;
  }

  spawnMangaSpeedLines() {
    this.speedLines = [];
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const len = Math.random() * 200 + 120;
      this.speedLines.push({
        x1: 200 + Math.cos(angle) * (len * 0.4),
        y1: 300 + Math.sin(angle) * (len * 0.4),
        x2: 200 + Math.cos(angle) * len,
        y2: 300 + Math.sin(angle) * len,
        alpha: 1.0,
        width: Math.random() * 3 + 1.5
      });
    }
  }

  update(dt) {
    this.timer += dt;

    if (this.state === 'aiming') {
      this.keeper.idleTimer += dt * 4;
      this.keeper.x = this.keeper.baseX + Math.sin(this.keeper.idleTimer) * 12;
      this.keeper.y = this.keeper.baseY + Math.abs(Math.cos(this.keeper.idleTimer)) * 3;

      if (Math.random() < 0.35) {
        this.auraParticles.push({
          x: this.keeper.x + (Math.random() - 0.5) * 40,
          y: this.keeper.y + Math.random() * 20,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 3 - 2,
          radius: Math.random() * 4 + 2,
          alpha: 0.8,
          color: Math.random() > 0.5 ? '#38bdf8' : '#facc15'
        });
      }
    }

    for (let i = this.auraParticles.length - 1; i >= 0; i--) {
      const p = this.auraParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= dt * 2.2;
      p.radius *= 0.94;
      if (p.alpha <= 0) this.auraParticles.splice(i, 1);
    }

    for (let i = this.speedLines.length - 1; i >= 0; i--) {
      this.speedLines[i].alpha -= dt * 2.8;
      if (this.speedLines[i].alpha <= 0) this.speedLines.splice(i, 1);
    }

    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 9 * dt;
    if (this.camera.shake > 0) {
      this.camera.shake -= dt * 38;
      if (this.camera.shake < 0) this.camera.shake = 0;
    }

    if (this.state === 'shooting' && this.ball.inFlight) {
      this.ball.progress += dt / this.ball.flightTime;
      const t = Math.min(1.0, this.ball.progress);

      const midX = (this.ball.startX + this.ball.targetX) * 0.5;
      const midY = (this.ball.startY + this.ball.targetY) * 0.38;

      this.ball.x = (1 - t) * (1 - t) * this.ball.startX + 2 * (1 - t) * t * midX + t * t * this.ball.targetX;
      this.ball.y = (1 - t) * (1 - t) * this.ball.startY + 2 * (1 - t) * t * midY + t * t * this.ball.targetY;
      this.ball.scale = 1.0 - t * 0.65;
      this.ball.rotation += dt * 25;

      this.ballFireTrail.push({
        x: this.ball.x,
        y: this.ball.y,
        radius: this.ball.radius * this.ball.scale * 1.3,
        alpha: 0.9,
        color: t > 0.5 ? '#f97316' : '#facc15'
      });

      if (this.ball.progress > this.keeper.reactionDelay) {
        this.keeper.diving = true;
        this.keeper.state = 'diving';

        this.keeper.x += (this.keeper.targetX - this.keeper.x) * this.keeper.diveSpeed * dt;
        this.keeper.y += (this.keeper.targetY - this.keeper.y) * this.keeper.diveSpeed * dt;

        const diveAngle = (this.keeper.targetX - 200) * 0.0065;
        this.keeper.rotation = diveAngle;
      }

      if (t >= 1.0) {
        this.ball.inFlight = false;
        if (!this.isOnlineMode) {
          this.resolveAnimePenalty();
        } else {
          this.resolveOnlineVisualOutcome();
        }
      }
    }

    for (let i = this.ballFireTrail.length - 1; i >= 0; i--) {
      this.ballFireTrail[i].alpha -= dt * 4.5;
      this.ballFireTrail[i].radius *= 0.92;
      if (this.ballFireTrail[i].alpha <= 0) this.ballFireTrail.splice(i, 1);
    }

    for (let r = 0; r <= this.netRows; r++) {
      for (let c = 0; c <= this.netCols; c++) {
        const node = this.netNodes[r][c];
        const springForce = (0 - node.z) * 14;
        node.vz += springForce * dt;
        node.vz *= 0.86;
        node.z += node.vz * dt;
      }
    }

    if (this.feedbackAlpha > 0) {
      this.feedbackAlpha -= dt * 0.7;
      this.feedbackScale += dt * 0.35;
    }
  }

  bulgeNet(impactX, impactY, depth = 45) {
    for (let r = 0; r <= this.netRows; r++) {
      for (let c = 0; c <= this.netCols; c++) {
        const node = this.netNodes[r][c];
        const dist = Math.hypot(node.origX - impactX, node.origY - impactY);
        if (dist < 70) {
          const power = (1 - dist / 70) * depth;
          node.z = power;
          node.vz = power * 3;
        }
      }
    }
  }

  resolveOnlineVisualOutcomeDirect(turnRole, isGoal) {
    if (this.ball.selectedZone) {
      this.ball.x = this.ball.selectedZone.x;
      this.ball.y = this.ball.selectedZone.y;
    }
    this.ball.scale = 0.6;
    this.camera.shake = isGoal ? 22 : 14;
    
    this.camera.targetZoom = 1.0;

    if (isGoal) {
      this.ball.result = 'goal';
      this.keeper.state = 'beaten';
      this.bulgeNet(this.ball.targetX, this.ball.targetY, 50);

      if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
      window.soundManager.playNetSwish();
      window.soundManager.playGoal();
      window.soundManager.playCrowdCheer();

      if (window.confettiEngine && window.confettiEngine.burst) {
        window.confettiEngine.burst(this.ball.targetX, this.ball.targetY, 95);
      }
      this.spawnMangaSpeedLines();
    } else {
      this.ball.result = 'saved';
      this.keeper.state = 'saved';

      if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
      window.soundManager.playCatch();
      window.soundManager.playCrowdGroan();
    }

    if (turnRole === 'shooter') {
      if (isGoal) {
        this.triggerFeedbackText('GOOOOOL! ⚽🔥', '¡Imparable al fondo de la red!', '#facc15');
      } else {
        this.triggerFeedbackText('oooh... 💨', 'El portero adivinó tu disparo', '#f87171');
      }
    } else if (turnRole === 'goalkeeper') {
      if (isGoal) {
        this.triggerFeedbackText('Gol del rival... ⚽', '¡Ajustó demasiado el lanzamiento!', '#fb923c');
      } else {
        this.triggerFeedbackText('¡PARADÓN! 🧤⚡', '¡Reflejos magistrales bajo palos!', '#38bdf8');
      }
    }
  }

  resolveAnimePenalty() {
    this.ball.inFlight = false;
    this.shotsTaken++;

    const playerZone = this.ball.selectedZone.id;
    const keeperZone = this.keeper.diveZoneId;

    if (playerZone === keeperZone) {
      this.ball.result = 'saved';
      this.keeper.state = 'saved';
      this.streak = 0;
      this.history.push('saved');
      this.camera.shake = 14;

      if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
      window.soundManager.playCatch();
      window.soundManager.playCrowdGroan();

      this.triggerFeedbackText('¡PARADÓN! 🧤', 'El portero adivinó la dirección del tiro.', '#38bdf8');
    } else {
      this.score += 100 + this.streak * 25;
      this.streak++;
      this.history.push('goal');
      this.triggerAnimeGoal('¡GOOOL! ⚽🔥', '¡Buen lanzamiento, directo a la red!', 100);
    }

    if (this.app && this.app.updateHUD) {
      this.app.updateHUD({
        score: this.score,
        streak: this.streak,
        levelInfo: `${this.currentLevel.flag} ${this.currentLevel.city}`,
        round: `${Math.min(this.shotsTaken + 1, this.maxShots)}/${this.maxShots}`,
        targetGoal: this.currentLevel.targetScore,
        history: this.history
      });
    }

    setTimeout(() => {
      this.camera.targetZoom = 1.0;
      if (this.shotsTaken >= this.maxShots) {
        this.finishShootout();
      } else {
        this.resetNextShot();
      }
    }, 1900);
  }

  triggerAnimeGoal(title, subtitle, pts) {
    this.ball.result = 'goal';
    this.keeper.state = 'beaten';

    this.camera.shake = 22;
    this.bulgeNet(this.ball.targetX, this.ball.targetY, 50);

    if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
    window.soundManager.playNetSwish();
    window.soundManager.playGoal();
    window.soundManager.playCrowdCheer();

    if (window.confettiEngine && window.confettiEngine.burst) {
      window.confettiEngine.burst(this.ball.targetX, this.ball.targetY, 95);
    }
    this.spawnMangaSpeedLines();

    this.triggerFeedbackText(title, subtitle, '#facc15');
  }

  triggerFeedbackText(title, subtitle, color) {
    this.feedbackTitle = title;
    this.feedbackSubtext = subtitle;
    this.feedbackColor = color;
    this.feedbackAlpha = 3.0;
    this.feedbackScale = 1.0;
  }

  resetNextShot() {
    this.ball.x = this.ball.startX;
    this.ball.y = this.ball.startY;
    this.ball.scale = 1.0;
    this.ball.progress = 0;
    this.ball.result = null;
    this.ball.inFlight = false;
    this.ball.selectedZone = null;

    this.keeper.x = this.keeper.baseX;
    this.keeper.y = this.keeper.baseY;
    this.keeper.rotation = 0;
    this.keeper.state = 'idle';
    this.keeper.diving = false;

    this.ballFireTrail = [];
    this.state = 'aiming';
  }

  finishShootout() {
    this.state = 'round_over';
    const goalsCount = this.history.filter(h => h === 'goal').length;
    const currentIdx = WORLD_TOUR_LEVELS.findIndex(l => l.id === this.currentLevel.id);
    const nextLevel = currentIdx < WORLD_TOUR_LEVELS.length - 1 ? WORLD_TOUR_LEVELS[currentIdx + 1] : null;

    const result = window.storageManager.saveLevelResult(
      this.currentLevel.id,
      goalsCount,
      this.currentLevel.targetScore,
      nextLevel ? nextLevel.id : null
    );

    this.app.showWorldTourLevelResult({
      level: this.currentLevel,
      nextLevel: nextLevel,
      goalsCount: goalsCount,
      totalShots: this.maxShots,
      passed: result.passed,
      starsEarned: result.starsEarned,
      unlockedNew: result.unlockedNew,
      score: this.score
    });
  }

  render(ctx) {
    ctx.save();

    if (this.camera.shake > 0) {
      const sx = (Math.random() - 0.5) * this.camera.shake;
      const sy = (Math.random() - 0.5) * this.camera.shake;
      ctx.translate(sx, sy);
    }

    if (this.camera.zoom !== 1.0) {
      ctx.translate(200, 300);
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-200, -300);
    }

    this.renderCountryStadium(ctx);
    this.renderAnimeNet(ctx);
    this.renderAnimePosts(ctx);

    if (this.state === 'aiming') {
      this.renderAnimeTargetDials(ctx);
    }

    this.renderCountryGoalkeeper(ctx);
    this.renderBallFireTrail(ctx);
    this.renderAnimeBall(ctx);
    this.renderMangaSpeedlines(ctx);

    if (!this.isOnlineMode && this.state === 'aiming' && this.dragStart && this.dragCurrent && this.activeZone) {
      this.renderAnimeAimArrow(ctx);
    }

    this.renderMangaBanner(ctx);

    ctx.restore();

    if (this.isOnlineMode) {
      this.renderOnlineRoleBanner(ctx);
      this.renderOnlineScoreboardOverlay(ctx);
    }
  }

  renderOnlineRoleBanner(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.fillRect(80, 45, 240, 36);
    ctx.strokeStyle = this.onlineRole === 'lanzador' ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 45, 240, 36);

    ctx.fillStyle = this.onlineRole === 'lanzador' ? '#facc15' : '#38bdf8';
    ctx.font = '900 14px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = this.onlineRole === 'lanzador' ? '🎯 TURNO: LANZADOR' : '🧤 TURNO: PORTERO';
    ctx.fillText(text, 200, 63);
    ctx.restore();
  }

  renderCountryStadium(ctx) {
    const lvl = this.currentLevel;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, 145);
    skyGrad.addColorStop(0, lvl.skyColors[0]);
    skyGrad.addColorStop(0.5, lvl.skyColors[1]);
    skyGrad.addColorStop(1, lvl.skyColors[2]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.vWidth, 145);

    this.drawCityLandmark(ctx, lvl);

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(0, 58); ctx.lineTo(400, 58); ctx.lineTo(400, 140);
    ctx.lineTo(0, 140); ctx.closePath();
    ctx.fill();

    for (let row = 0; row < 3; row++) {
      const y = 70 + row * 19;
      ctx.fillStyle = row % 2 ? '#263449' : '#182436';
      ctx.fillRect(0, y, 400, 17);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(0, y + 16, 400, 2);

      for (let x = 5; x < 400; x += 9) {
        const palette = this.getCrowdColor(lvl, x, row);
        ctx.fillStyle = palette;
        ctx.beginPath();
        ctx.arc(x, y + 5 + ((x + row) % 3), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let x = 22 + (row % 2) * 30; x < 400; x += 92) {
        this.drawCountryFlag(ctx, lvl, x, y + 2, 19, 12);
      }
    }

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 64); ctx.lineTo(58, 48); ctx.lineTo(200, 61);
    ctx.lineTo(342, 48); ctx.lineTo(400, 64);
    ctx.moveTo(60, 49); ctx.lineTo(60, 70);
    ctx.moveTo(340, 49); ctx.lineTo(340, 70);
    ctx.stroke();
    this.drawAnimeFloodlight(ctx, 40, 24);
    this.drawAnimeFloodlight(ctx, 360, 24);

    this.drawCountryFlag(ctx, lvl, 101, 12, 35, 22);
    this.drawCountryFlag(ctx, lvl, 264, 12, 35, 22);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 126, this.vWidth, 17);
    ctx.fillStyle = lvl.jerseyColor[1];
    ctx.font = '900 10px Fredoka, sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = lvl.jerseyColor[1];
    ctx.shadowBlur = 8;
    ctx.fillText(this.isOnlineMode ? '⚡ DUELO 1 VS 1 ONLINE — FÚTBOLÍN KIDS ARENA ⚡' : lvl.ledText, 10, 138);
    ctx.shadowBlur = 0;

    const grassGrad = ctx.createLinearGradient(0, 142, 0, this.vHeight);
    grassGrad.addColorStop(0, '#15803d');
    grassGrad.addColorStop(0.5, '#16a34a');
    grassGrad.addColorStop(1, '#22c55e');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 142, this.vWidth, this.vHeight - 142);

    let cy = 142;
    let h = 16;
    let toggle = false;
    while (cy < this.vHeight) {
      if (toggle) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, cy, this.vWidth, h);
      }
      cy += h;
      h += 4;
      toggle = !toggle;
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(25, 275); ctx.lineTo(375, 275);
    ctx.stroke();

    ctx.strokeRect(90, 275, 220, 58);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(200, 510, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(200, 510, 55, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  getCrowdColor(level, x, row) {
    const colors = [
      level.jerseyColor[1],
      level.jerseyColor[0],
      '#f8fafc',
      level.shortsColor,
      '#facc15'
    ];
    return colors[(Math.floor(x / 9) * 7 + row * 3) % colors.length];
  }

  drawCountryFlag(ctx, level, x, y, width, height) {
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);

    if (level.id === 'tokyo') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, height * 0.29, 0, Math.PI * 2);
      ctx.fill();
    } else if (level.id === 'rio') {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y + 2);
      ctx.lineTo(x + width - 2, y + height / 2);
      ctx.lineTo(x + width / 2, y + height - 2);
      ctx.lineTo(x + 2, y + height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, height * 0.23, 0, Math.PI * 2);
      ctx.fill();
    } else if (level.id === 'munich') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(x, y, width, height / 3);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x, y + height / 3, width, height / 3);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x, y + (height * 2) / 3, width, height / 3);
    } else if (level.id === 'milan') {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x, y, width / 3, height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + width / 3, y, width / 3, height);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + (width * 2) / 3, y, width / 3, height);
    } else {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x, y + height * 0.25, width, height * 0.5);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(x + width * 0.34, y + height / 2, height * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawCityLandmark(ctx, level) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (level.id === 'tokyo') {
      ctx.fillStyle = 'rgba(8, 15, 40, 0.88)';
      [[12, 45, 27, 34], [45, 34, 25, 45], [330, 38, 24, 41], [365, 48, 25, 31]].forEach(([x, y, w, h]) => {
        ctx.fillRect(x, y, w, h);
      });
      ctx.fillStyle = '#fbbf24';
      for (let x = 16; x < 390; x += 18) {
        ctx.fillRect(x, 57 + (x % 3) * 3, 3, 4);
      }
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(187, 76); ctx.lineTo(200, 22); ctx.lineTo(213, 76);
      ctx.moveTo(191, 60); ctx.lineTo(209, 60);
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(197, 17, 6, 5);
    } else if (level.id === 'rio') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, 82); ctx.lineTo(0, 65); ctx.quadraticCurveTo(45, 57, 77, 71);
      ctx.quadraticCurveTo(112, 74, 143, 50); ctx.quadraticCurveTo(163, 42, 179, 76);
      ctx.lineTo(224, 82); ctx.quadraticCurveTo(251, 60, 275, 71);
      ctx.quadraticCurveTo(319, 78, 343, 47); ctx.quadraticCurveTo(370, 42, 400, 66);
      ctx.lineTo(400, 88); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(201, 42); ctx.lineTo(201, 72);
      ctx.stroke();
    } else if (level.id === 'munich') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      ctx.moveTo(0, 83); ctx.lineTo(0, 65); ctx.lineTo(42, 27); ctx.lineTo(77, 65);
      ctx.lineTo(119, 34); ctx.lineTo(158, 72); ctx.lineTo(201, 22); ctx.lineTo(245, 71);
      ctx.lineTo(284, 36); ctx.lineTo(324, 74); ctx.lineTo(365, 29); ctx.lineTo(400, 66);
      ctx.lineTo(400, 88); ctx.closePath(); ctx.fill();
    } else if (level.id === 'milan') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(148, 49, 104, 35);
      ctx.beginPath();
      ctx.moveTo(139, 53); ctx.lineTo(160, 38); ctx.lineTo(171, 47);
      ctx.lineTo(184, 28); ctx.lineTo(195, 45); ctx.lineTo(207, 16);
      ctx.lineTo(218, 45); ctx.lineTo(234, 29); ctx.lineTo(246, 48);
      ctx.lineTo(261, 39); ctx.lineTo(272, 55); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(30, 20, 43, 0.92)';
      ctx.fillRect(125, 54, 150, 30);
    }

    ctx.restore();
  }

  drawAnimeFloodlight(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x - 3, y, 6, 32);

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 28, y); ctx.lineTo(x + 28, y);
    ctx.moveTo(x, y - 28); ctx.lineTo(x, y + 28);
    ctx.stroke();
    ctx.restore();
  }

  renderAnimeNet(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1.3;

    for (let c = 0; c <= this.netCols; c++) {
      ctx.beginPath();
      for (let r = 0; r <= this.netRows; r++) {
        const n = this.netNodes[r][c];
        const nx = n.origX + (n.z * 0.22);
        const ny = n.origY + (n.z * 0.16);
        if (r === 0) ctx.moveTo(nx, ny);
        else ctx.lineTo(nx, ny);
      }
      ctx.stroke();
    }

    for (let r = 0; r <= this.netRows; r++) {
      ctx.beginPath();
      for (let c = 0; c <= this.netCols; c++) {
        const n = this.netNodes[r][c];
        const nx = n.origX + (n.z * 0.22);
        const ny = n.origY + (n.z * 0.16);
        if (c === 0) ctx.moveTo(nx, ny);
        else ctx.lineTo(nx, ny);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  renderAnimePosts(ctx) {
    const g = this.goal;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(g.x - 3, g.y + g.h - 3, g.w + 6, 8);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = g.postWidth + 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(g.x, g.y + g.h);
    ctx.lineTo(g.x, g.y);
    ctx.lineTo(g.x + g.w, g.y);
    ctx.lineTo(g.x + g.w, g.y + g.h);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = g.postWidth - 2;
    ctx.stroke();
    ctx.restore();
  }

  renderAnimeTargetDials(ctx) {
    this.TARGET_ZONES.forEach(z => {
      const isSelected = this.activeZone && this.activeZone.id === z.id;
      const isHovered = this.hoverZone && this.hoverZone.id === z.id;

      ctx.save();
      ctx.translate(z.x, z.y);

      const pulse = isSelected ? Math.sin(this.timer * 10) * 5 : 0;
      const r = (isSelected ? 32 : 26) + pulse;

      if (isSelected || isHovered) {
        ctx.fillStyle = isSelected ? 'rgba(250, 204, 21, 0.45)' : 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, r + 15, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = isSelected ? '#facc15' : isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = isSelected ? 3.5 : 2;

      const len = 10;
      ctx.beginPath();
      ctx.moveTo(-r, -r + len); ctx.lineTo(-r, -r); ctx.lineTo(-r + len, -r);
      ctx.moveTo(r - len, -r); ctx.lineTo(r, -r); ctx.lineTo(r, -r + len);
      ctx.moveTo(-r, r - len); ctx.lineTo(-r, r); ctx.lineTo(-r + len, r);
      ctx.moveTo(r - len, r); ctx.lineTo(r, r); ctx.lineTo(r, r - len);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(z.icon, 0, 0);

      // (Textos flotantes eliminados a petición)

      ctx.restore();
    });
  }

  renderCountryGoalkeeper(ctx) {
    const k = this.keeper;
    const lvl = this.currentLevel;

    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.rotation);

    this.auraParticles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x - k.x, p.y - k.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 40, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-16, 28, 12, 12);
    ctx.fillRect(4, 28, 12, 12);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, 8, 8, 22);
    ctx.fillRect(6, 8, 8, 22);

    ctx.fillStyle = lvl.shortsColor;
    ctx.beginPath();
    ctx.roundRect(-17, -2, 34, 18, 4);
    ctx.fill();

    const jerseyGrad = ctx.createLinearGradient(-20, -32, 20, 10);
    jerseyGrad.addColorStop(0, lvl.jerseyColor[0]);
    jerseyGrad.addColorStop(1, lvl.jerseyColor[1]);
    ctx.fillStyle = jerseyGrad;
    ctx.beginPath();
    ctx.roundRect(-20, -30, 40, 32, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-10, -30); ctx.lineTo(0, -22); ctx.lineTo(10, -30);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = lvl.hairColor;
    ctx.beginPath();
    if (lvl.keeperType === 'muller') {
      ctx.moveTo(-18, -48); ctx.lineTo(0, -62); ctx.lineTo(18, -48);
      ctx.lineTo(24, -34); ctx.lineTo(-24, -34);
    } else {
      ctx.moveTo(-16, -36); ctx.lineTo(-24, -30); ctx.lineTo(-14, -28);
      ctx.moveTo(16, -36); ctx.lineTo(24, -30); ctx.lineTo(14, -28);
      ctx.moveTo(-12, -26); ctx.lineTo(0, -20); ctx.lineTo(12, -26);
    }
    ctx.fill();

    ctx.fillStyle = lvl.skinColor;
    ctx.beginPath();
    ctx.arc(0, -42, 13, 0, Math.PI * 2);
    ctx.fill();

    if (lvl.headbandColor) {
      ctx.fillStyle = lvl.headbandColor;
      ctx.fillRect(-13, -48, 26, 4.5);
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8, -46, 6, 2);
    ctx.fillRect(2, -46, 6, 2);

    if (lvl.hasCap) {
      ctx.fillStyle = lvl.capColor;
      ctx.beginPath();
      ctx.arc(0, -48, 14, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    const span = k.diving ? 44 : 28;
    const gy = k.diving ? -48 : -14;
    this.drawKeeperGlove(ctx, -span, gy, false);
    this.drawKeeperGlove(ctx, span, gy, true);

    ctx.restore();
  }

  drawKeeperGlove(ctx, x, y, isRight) {
    ctx.save();
    ctx.translate(x, y);
    if (isRight) ctx.scale(-1, 1);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(-14, -18, 28, 30, 9);
    ctx.fill();
    ctx.restore();
  }

  renderBallFireTrail(ctx) {
    ctx.save();
    this.ballFireTrail.forEach(f => {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  renderAnimeBall(ctx) {
    const b = this.ball;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.scale, b.scale);

    if (b.inFlight) {
      const angle = Math.atan2(b.targetY - b.startY, b.targetX - b.startX);
      ctx.rotate(angle);
      ctx.scale(1.35, 0.75);
      ctx.rotate(-angle);
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    ctx.restore();
  }

  renderMangaSpeedlines(ctx) {
    if (this.speedLines.length === 0) return;
    ctx.save();
    this.speedLines.forEach(l => {
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, l.alpha)})`;
      ctx.lineWidth = l.width;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  renderMangaBanner(ctx) {
    if (this.feedbackAlpha <= 0) return;
    ctx.save();
    ctx.translate(200, 285);
    ctx.scale(this.feedbackScale, this.feedbackScale);
    ctx.globalAlpha = Math.max(0, this.feedbackAlpha);

    ctx.save();
    ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
    ctx.fillRect(-180, -32, 360, 72);
    ctx.strokeStyle = this.feedbackColor;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(-180, -32, 360, 72);

    ctx.fillStyle = this.feedbackColor;
    ctx.font = '900 26px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.feedbackTitle, 0, 2);

    if (this.feedbackSubtext) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Fredoka, sans-serif';
      ctx.fillText(this.feedbackSubtext, 0, 26);
    }
    ctx.restore();
    ctx.restore();
  }
}

window.PenaltisGame = PenaltisGame;
