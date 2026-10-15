/**
 * Futbolín Kids Arena - Motor de penaltis para duelos online.
 */

const ARENA_LEVEL = {
    id: 'arena',
    number: 1,
    city: 'Arena',
    country: 'Mundial',
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
    description: 'Duelo de penaltis online.'
  };

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

    this.currentLevel = ARENA_LEVEL;
    this.isOnlineMode = false;
    this.onlineRole = null;
    this.onOnlineActionSubmit = null;

    this.initNetMesh();
    this.initArenaAtmosphere();

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

  initArenaAtmosphere() {
    this.arenaBackground = new Image();
    this.arenaBackground.src = './assets/penalty-stadium-torches.png';
    this.crowdLights = Array.from({ length: 115 }, (_, index) => ({
      x: 20 + Math.random() * 920,
      y: 105 + Math.random() * 180,
      radius: .45 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 3.5,
      color: ['#ffe28a', '#6be7ff', '#ff805c', '#ffffff'][index % 4]
    }));
    this.fireEmbers = [];
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
    if (this.isOnlineMode && this.ball?.inFlight) {
      this.pendingOnlineTurn = turnMessage;
      return;
    }
    this.pendingOnlineTurn = null;
    const recoveringKeeper = ['saved', 'beaten'].includes(this.keeper.state) && this.keeper.landingTimer < 0.58;
    this.onlineRole = turnMessage.role === 'shooter' ? 'lanzador' : 'portero';
    this.state = 'aiming';
    this.activeZone = null;
    this.hoverZone = null;
    this.ball.inFlight = false;
    this.ball.inNet = false;
    this.ball.velocityX = this.ball.velocityY = 0;
    this.ball.x = this.ball.startX;
    this.ball.y = this.ball.startY;
    if (!recoveringKeeper) {
      this.keeper.x = this.keeper.baseX;
      this.keeper.y = this.keeper.baseY;
      this.keeper.rotation = 0;
      this.keeper.state = 'idle';
      this.keeper.landingTimer = 0;
    }
    this.keeper.recovering = recoveringKeeper;
    this.keeper.diving = false;
    this.keeper.diveProgress = 0;
    this.keeper.anticipating = false;
    if (!recoveringKeeper) this.keeper.diveDirection = 0;
  }

  triggerOnlineShotAnimation(shooterZoneId, keeperZoneId, turnRole, isGoal) {
    const targetZone = this.TARGET_ZONES.find(z => z.id === shooterZoneId) || this.TARGET_ZONES[2];
    this.onlineVisualTurnRole = turnRole;
    this.onlineVisualIsGoal = isGoal;
    this.ball.flightTime = 0.42;
    this.launchAnimeShot(targetZone, keeperZoneId);
  }
  // ----------------------

  initNetMesh() {
    this.netCols = 32;
    this.netRows = 16;
    this.netNodes = [];

    const gx = 40, gy = 110, gw = 320, gh = 170;
    for (let r = 0; r <= this.netRows; r++) {
      this.netNodes[r] = [];
      for (let c = 0; c <= this.netCols; c++) {
        const u = c / this.netCols;
        const v = r / this.netRows;
        this.netNodes[r][c] = {
          origX: u * 7.32,
          origY: (1 - v) * 2.44,
          x: u * 7.32,
          y: (1 - v) * 2.44,
          depth: 1.8,
          vx: 0,
          vy: 0,
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
      x: 40,
      y: 110,
      w: 320,
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
      diveProgress: 0,
      landingTimer: 0,
      recovering: false,
      diveDirection: 0,
      diveStartX: 200,
      diveStartY: 230,
      anticipating: false,
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
      velocityX: 0,
      velocityY: 0,
      inNet: false,
      netAge: 0,
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

  start() {
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
    
    const boxX = 198;
    const boxY = 8;
    const boxW = 564;
    const boxH = 70;
    
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
    const sweepProgress = ((this.timer * 0.7) % 3.0) / 3.0;
    const sweepX = boxX + 14 + (boxW - 28) * sweepProgress;

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
    const infY = boxY + 51;

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
    x = this.toSceneX(x);

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
    x = this.toSceneX(x);

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
    x = this.toSceneX(x);
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

  toSceneX(x) {
    const scale = 1.5;
    const offset = (this.app.virtualWidth - this.vWidth * scale) / 2;
    return (x - offset) / scale;
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
    this.feedbackAlpha = 0;
    this.feedbackAge = 0;
    this.feedbackTitle = '';
    this.feedbackSubtext = '';
    this.state = 'shooting';
    this.ball.inFlight = true;
    this.ball.inNet = false;
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
    this.keeper.diveDirection = Math.sign(chosenZone.x - this.keeper.baseX);
    // Move the torso toward the shot while the leading glove reaches the actual corner.
    this.keeper.targetX = chosenZone.x - this.keeper.diveDirection * 58;
    this.keeper.targetY = keeperChoiceId === 'center' ? 220 : chosenZone.y;
    this.keeper.diveStartX = this.keeper.x;
    this.keeper.diveStartY = this.keeper.y;
    this.keeper.diveProgress = 0;
    this.keeper.landingTimer = 0;
    this.keeper.anticipating = false;
    this.keeper.recovering = false;
    this.keeper.rotation = 0;
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

    if (Math.random() < dt * 24 && this.fireEmbers.length < 90) {
      const side = Math.random() < .5 ? 1 : -1;
      const sourceX = side > 0 ? 930 : 30;
      this.fireEmbers.push({
        x: sourceX + (Math.random() - .5) * 16,
        y: 254 + Math.random() * 10,
        vx: -side * (3 + Math.random() * 14) + (Math.random() - .5) * 7,
        vy: -(34 + Math.random() * 58),
        size: .8 + Math.random() * 2.4,
        life: .6 + Math.random() * .9,
        age: 0,
        hue: Math.random() < .5 ? 24 : 42
      });
    }
    for (let i = this.fireEmbers.length - 1; i >= 0; i--) {
      const ember = this.fireEmbers[i];
      ember.age += dt;
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      ember.vy -= 9 * dt;
      if (ember.age >= ember.life) this.fireEmbers.splice(i, 1);
    }

    if (this.state === 'aiming') {
      this.keeper.idleTimer += dt;
      if (this.keeper.recovering) {
        this.keeper.landingTimer += dt;
        const recovery = Math.min(1, this.keeper.landingTimer / .58);
        this.keeper.x += (this.keeper.baseX - this.keeper.x) * Math.min(1, dt * 5);
        this.keeper.y += (this.keeper.baseY - this.keeper.y) * Math.min(1, dt * 5);
        this.keeper.rotation *= Math.exp(-dt * 7);
        if (recovery >= 1) {
          this.keeper.recovering = false;
          this.keeper.state = 'idle';
          this.keeper.rotation = 0;
          this.keeper.diveDirection = 0;
        }
      } else {
        this.keeper.x = this.keeper.baseX + Math.sin(this.keeper.idleTimer * 1.4) * 3.5;
        this.keeper.y = this.keeper.baseY + Math.abs(Math.cos(this.keeper.idleTimer * 2.1)) * 1.8;
      }
      this.keeper.anticipating = false;

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

      const anticipationStart = this.keeper.reactionDelay * 0.58;
      this.keeper.anticipating = this.ball.progress >= anticipationStart && this.ball.progress <= this.keeper.reactionDelay;
      if (this.ball.progress > this.keeper.reactionDelay) {
        this.keeper.diving = true;
        this.keeper.state = 'diving';
        const rawDive = Math.min(1, (this.ball.progress - this.keeper.reactionDelay) / Math.max(.12, 1 - this.keeper.reactionDelay));
        const easedDive = 1 - Math.pow(1 - rawDive, 3);
        this.keeper.diveProgress = easedDive;
        this.keeper.x = this.keeper.diveStartX + (this.keeper.targetX - this.keeper.diveStartX) * easedDive;
        const leap = Math.sin(rawDive * Math.PI) * (this.keeper.targetY <= this.keeper.diveStartY ? 13 : 5);
        this.keeper.y = this.keeper.diveStartY + (this.keeper.targetY - this.keeper.diveStartY) * easedDive - leap;
        this.keeper.rotation = this.keeper.diveDirection * .88 * easedDive;
        this.keeper.anticipating = false;
      }

      if (t >= 1.0) {
        this.ball.inFlight = false;
        this.keeper.diveProgress = 1;
        this.keeper.diving = false;
        this.keeper.anticipating = false;
        this.keeper.landingTimer = 0;
        if (!this.isOnlineMode) {
          this.resolveAnimePenalty();
        } else {
          this.resolveOnlineVisualOutcomeDirect(this.onlineVisualTurnRole, this.onlineVisualIsGoal);
          this.state = 'aiming';
          if (this.pendingOnlineTurn) this.setOnlineTurn(this.pendingOnlineTurn);
        }
      }
    }

    if (this.ball.inNet) {
      const ball = this.ball;
      ball.netAge += dt;
      ball.velocityY += 390 * dt;
      ball.x += ball.velocityX * dt;
      ball.y += ball.velocityY * dt;
      ball.velocityX *= Math.exp(-2.2 * dt);
      ball.velocityY *= Math.exp(-.45 * dt);
      ball.rotation += dt * 5;
      const left = this.goal.x + 17, right = this.goal.x + this.goal.w - 17;
      const bottom = this.goal.y + this.goal.h - 18;
      if (ball.x < left || ball.x > right) {
        ball.x = Math.max(left, Math.min(right, ball.x));
        ball.velocityX *= -.42;
      }
      if (ball.y > bottom) {
        ball.y = bottom;
        ball.velocityY *= -.34;
        if (Math.abs(ball.velocityY) < 20) ball.velocityY = 0;
      }
      if (ball.netAge > 1.25) {
        ball.inNet = false;
        ball.velocityX = ball.velocityY = 0;
      }
    }

    if (this.isOnlineMode && !this.ball.inFlight && ['saved', 'beaten'].includes(this.keeper.state)) {
      this.keeper.recovering = true;
      if (this.state !== 'aiming') this.keeper.landingTimer += dt;
      if (this.keeper.landingTimer > .58) {
        this.keeper.recovering = false;
        this.keeper.state = 'idle';
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
        const left = this.netNodes[r][Math.max(0, c - 1)];
        const right = this.netNodes[r][Math.min(this.netCols, c + 1)];
        const up = this.netNodes[Math.max(0, r - 1)][c];
        const down = this.netNodes[Math.min(this.netRows, r + 1)][c];
        const edge = c === 0 || c === this.netCols || r === 0 || r === this.netRows;
        const stiffness = edge ? 68 : 32;
        const neighborX = (left.x + right.x + up.x + down.x) * .25;
        const neighborY = (left.y + right.y + up.y + down.y) * .25;
        const neighborDepth = (left.depth + right.depth + up.depth + down.depth) * .25;
        node.vx += ((node.origX - node.x) * stiffness + (neighborX - node.x) * 9) * dt;
        node.vy += ((node.origY - node.y) * stiffness + (neighborY - node.y) * 9) * dt;
        node.vz += ((1.8 - node.depth) * stiffness * .8 + (neighborDepth - node.depth) * 8) * dt;
        const damping = Math.exp(-5.2 * dt);
        node.vx *= damping; node.vy *= damping; node.vz *= damping;
        node.x += node.vx * dt; node.y += node.vy * dt; node.depth += node.vz * dt;
        if (Math.abs(node.x - node.origX) < .0008 && Math.abs(node.vx) < .012) node.x = node.origX, node.vx = 0;
        if (Math.abs(node.y - node.origY) < .0008 && Math.abs(node.vy) < .012) node.y = node.origY, node.vy = 0;
        if (Math.abs(node.depth - 1.8) < .0008 && Math.abs(node.vz) < .012) node.depth = 1.8, node.vz = 0;
      }
    }

    if (this.feedbackAlpha > 0) {
      this.feedbackAge += dt;
      const popProgress = Math.min(1, this.feedbackAge / 0.14);
      this.feedbackScale = 0.72 + 0.28 * (1 - Math.pow(1 - popProgress, 3))
        + Math.sin(this.feedbackAge * 25) * Math.exp(-this.feedbackAge * 13) * 0.08;
      this.feedbackAlpha = this.feedbackAge < 0.48
        ? 1
        : Math.max(0, 1 - (this.feedbackAge - 0.48) / 0.24);
    }
  }

  bulgeNet(impactX, impactY, depth = 45) {
    const hitX = Math.max(0, Math.min(7.32, ((impactX - this.goal.x) / this.goal.w) * 7.32));
    const hitY = Math.max(0, Math.min(2.44, ((this.goal.y + this.goal.h - impactY) / this.goal.h) * 2.44));
    const impulse = Math.max(.8, Math.min(4.4, depth * .075));
    for (let r = 0; r <= this.netRows; r++) {
      for (let c = 0; c <= this.netCols; c++) {
        const node = this.netNodes[r][c];
        const dx = node.origX - hitX;
        const dy = node.origY - hitY;
        const dist = Math.hypot(dx, dy * 1.35);
        if (dist < 1.35) {
          const falloff = Math.pow(1 - dist / 1.35, 2);
          node.vz += impulse * falloff;
          node.vx += dx * falloff * .72;
          node.vy += dy * falloff * .62;
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
      this.ball.inNet = true;
      this.ball.netAge = 0;
      this.ball.velocityX = (this.ball.startX - this.ball.targetX) * .34;
      this.ball.velocityY = 86;
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
      this.ball.inNet = false;
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
    this.ball.inNet = true;
    this.ball.netAge = 0;
    this.ball.velocityX = (this.ball.startX - this.ball.targetX) * .34;
    this.ball.velocityY = 86;
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
    this.feedbackAlpha = 1;
    this.feedbackAge = 0;
    this.feedbackScale = 0.72;
  }

  resetNextShot() {
    this.ball.x = this.ball.startX;
    this.ball.y = this.ball.startY;
    this.ball.scale = 1.0;
    this.ball.progress = 0;
    this.ball.result = null;
    this.ball.inFlight = false;
    this.ball.inNet = false;
    this.ball.velocityX = this.ball.velocityY = 0;
    this.ball.selectedZone = null;

    this.keeper.x = this.keeper.baseX;
    this.keeper.y = this.keeper.baseY;
    this.keeper.rotation = 0;
    this.keeper.state = 'idle';
    this.keeper.diving = false;
    this.keeper.diveProgress = 0;
    this.keeper.landingTimer = 0;
    this.keeper.recovering = false;
    this.keeper.anticipating = false;
    this.keeper.diveDirection = 0;

    this.ballFireTrail = [];
    this.state = 'aiming';
  }

  finishShootout() {
    this.state = 'round_over';
    const goalsCount = this.history.filter(result => result === 'goal').length;
    const isNewRecord = window.storageManager.setScore('penaltis', this.score, goalsCount);
    this.app.showGameOver({
      title: 'Tanda finalizada',
      subtitle: `${goalsCount}/${this.maxShots} goles`,
      score: this.score,
      highScore: window.storageManager.getHighScore('penaltis'),
      isNewRecord
    });
  }

  render(ctx) {
    ctx.save();
    this.renderCountryStadium(ctx);
    const sceneScaleX = 1.5;
    const sceneOffsetX = (this.app.virtualWidth - this.vWidth * sceneScaleX) / 2;
    ctx.translate(sceneOffsetX, 0);
    ctx.scale(sceneScaleX, 1);
    if (this.camera.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.camera.shake, (Math.random() - 0.5) * this.camera.shake);
    }
    if (this.camera.zoom !== 1.0) {
      ctx.translate(200, 300);
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-200, -300);
    }

    this.renderPenaltyPitchDetails(ctx);
    this.renderAnimeNet(ctx);
    this.renderAnimePosts(ctx);

    if (this.state === 'aiming') {
      this.renderAnimeTargetDials(ctx);
    }

    // Keep the keeper and ball round while the goal and pitch gain the wider perspective.
    ctx.save();
    ctx.translate(this.keeper.x, 0);
    ctx.scale(1 / sceneScaleX, 1);
    ctx.translate(-this.keeper.x, 0);
    this.renderCountryGoalkeeper(ctx);
    ctx.restore();
    ctx.save();
    ctx.translate(this.ball.x, 0);
    ctx.scale(1 / sceneScaleX, 1);
    ctx.translate(-this.ball.x, 0);
    this.renderBallFireTrail(ctx);
    this.renderAnimeBall(ctx);
    ctx.restore();
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
    ctx.fillRect(390, 78, 180, 25);
    ctx.strokeStyle = this.onlineRole === 'lanzador' ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(390, 78, 180, 25);

    ctx.fillStyle = this.onlineRole === 'lanzador' ? '#facc15' : '#38bdf8';
    ctx.font = '900 14px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = this.onlineRole === 'lanzador' ? '🎯 TURNO: LANZADOR' : '🧤 TURNO: PORTERO';
    ctx.fillText(text, 480, 90);
    ctx.restore();
  }

  renderCountryStadium(ctx) {
    const image = this.arenaBackground;
    if (!image?.complete || !image.naturalWidth) {
      const fallback = ctx.createLinearGradient(0, 0, 0, this.app.virtualHeight);
      fallback.addColorStop(0, '#071426'); fallback.addColorStop(.55, '#071c20'); fallback.addColorStop(1, '#087a35');
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, this.app.virtualWidth, this.app.virtualHeight);
    } else {
      ctx.drawImage(image, 0, 0, this.app.virtualWidth, this.app.virtualHeight);
    }

    const width = this.app.virtualWidth;
    const height = this.app.virtualHeight;
    // Stadium lights sweep through the crowd and graze the pitch like moving fixtures.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sweep = Math.sin(this.timer * .28) * width * .2;
    for (const [i, sourceX] of [width * .12, width * .88].entries()) {
      const endX = width * (.5 + (i ? -1 : 1) * .24) + sweep;
      const gradient = ctx.createLinearGradient(sourceX, 20, endX, height * .68);
      gradient.addColorStop(0, `rgba(211,244,255,${this.ball?.inFlight ? .12 : .075})`);
      gradient.addColorStop(.55, 'rgba(124,230,255,.035)');
      gradient.addColorStop(1, 'rgba(255,180,77,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(sourceX - 9, 22);
      ctx.lineTo(endX - 115, height * .68);
      ctx.lineTo(endX + 115, height * .68);
      ctx.lineTo(sourceX + 9, 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // The pyrotechnics are anchored to the stadium towers in the background plate.
    this.renderFireEffects(ctx);

    // Thousands of tiny crowd reflections pulse as an arena-wide wave.
    ctx.save();
    for (const light of this.crowdLights) {
      const pulse = .14 + (Math.sin(this.timer * light.speed + light.phase) + 1) * .2;
      const sway = Math.sin(this.timer * .7 + light.phase) * .8;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = light.color;
      ctx.beginPath();
      ctx.arc(light.x + sway, light.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Fire particles rise from the fixed braziers, carrying their light into smoke and grass.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ember of this.fireEmbers) {
      const fade = Math.max(0, 1 - ember.age / ember.life);
      ctx.globalAlpha = fade * .82;
      ctx.fillStyle = `hsl(${ember.hue} 100% ${55 + fade * 18}%)`;
      ctx.shadowColor = ember.hue < 30 ? '#ff5b20' : '#ffd34e';
      ctx.shadowBlur = ember.size * 4;
      ctx.beginPath();
      ctx.ellipse(ember.x, ember.y, ember.size * .58, ember.size * 1.25, ember.vx * .015, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const vignette = ctx.createRadialGradient(width / 2, height * .43, width * .2, width / 2, height * .43, width * .75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(1,7,14,.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  renderPenaltyPitchDetails(ctx) {
    ctx.save();
    const grassGlow = ctx.createRadialGradient(200, 475, 2, 200, 475, 155);
    grassGlow.addColorStop(0, 'rgba(185,255,188,.11)');
    grassGlow.addColorStop(1, 'rgba(5,22,15,0)');
    ctx.fillStyle = grassGlow;
    ctx.fillRect(15, 320, 370, 280);
    ctx.strokeStyle = 'rgba(231,255,235,.48)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(200, this.ball.startY + 15, 58, 21, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.shadowColor = '#d9ffe6';
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(this.ball.startX, this.ball.startY + 15, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  }

  renderFireEffects(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const height = this.app.virtualHeight;
    for (const [index, sourceX] of [30, this.app.virtualWidth - 30].entries()) {
      const phase = this.timer * 5.8 + sourceX;
      const baseY = height * .423;
      const flicker = .78 + Math.sin(phase) * .12 + Math.sin(phase * 2.7) * .1;
      const torchX = index === 0 ? sourceX + 7 : sourceX - 7;
      const glow = ctx.createRadialGradient(torchX, baseY - 8, 2, torchX, baseY, 66);
      glow.addColorStop(0, `rgba(255,178,70,${.46 * flicker})`);
      glow.addColorStop(.34, `rgba(255,82,22,${.19 * flicker})`);
      glow.addColorStop(1, 'rgba(255,55,15,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(torchX - 72, baseY - 78, 144, 118);
      ctx.globalCompositeOperation = 'lighter';
      for (let tongue = 0; tongue < 7; tongue++) {
        const phaseTongue = phase + tongue * 1.53;
        const x = torchX + Math.sin(phaseTongue * .73) * (5 + tongue * .8);
        const flameHeight = (42 + (Math.sin(phaseTongue) + 1) * 21) * flicker;
        const tongueWidth = 4 + (Math.cos(phaseTongue * .8) + 1) * 3.2;
        const lean = Math.sin(phaseTongue * .45) * 6;
        const flame = ctx.createLinearGradient(x, baseY, x + lean, baseY - flameHeight);
        flame.addColorStop(0, 'rgba(255,53,8,.12)');
        flame.addColorStop(.3, 'rgba(255,83,14,.88)');
        flame.addColorStop(.68, 'rgba(255,154,35,.97)');
        flame.addColorStop(.9, 'rgba(255,224,115,.9)');
        flame.addColorStop(1, 'rgba(255,249,202,.02)');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(x - tongueWidth, baseY + 1);
        ctx.bezierCurveTo(x - tongueWidth * 1.45, baseY - flameHeight * .22, x + lean * .65, baseY - flameHeight * .62, x + lean, baseY - flameHeight);
        ctx.bezierCurveTo(x + lean + tongueWidth * 1.15, baseY - flameHeight * .68, x + tongueWidth * 1.35, baseY - flameHeight * .24, x + tongueWidth, baseY + 1);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'screen';
    }
    ctx.restore();
  }

  renderClassicStadium(ctx) {
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

  projectGoal3D(x, y, depth = 0) {
    const d = Math.max(0, Math.min(2.2, depth));
    return {
      x: 200 + (x / 7.32 - .5) * 320 * (1 - d * .04),
      y: 280 - (y / 2.44) * 170 - d * 5.8
    };
  }

  drawGoalTube(ctx, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length, ny = dx / length, radius = 5.8;
    const midX = (a.x + b.x) * .5;
    ctx.save();
    // Cancel the field's horizontal camera expansion locally, keeping each metal tube round.
    ctx.translate(midX, 0); ctx.scale(1 / 1.5, 1); ctx.translate(-midX, 0);
    const metal = ctx.createLinearGradient(
      (a.x + b.x) * .5 - nx * radius, (a.y + b.y) * .5 - ny * radius,
      (a.x + b.x) * .5 + nx * radius, (a.y + b.y) * .5 + ny * radius);
    metal.addColorStop(0, '#344750'); metal.addColorStop(.18, '#b9cbd1');
    metal.addColorStop(.42, '#ffffff'); metal.addColorStop(.62, '#91a7af'); metal.addColorStop(1, '#344750');
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x + 2, a.y + 5); ctx.lineTo(b.x + 2, b.y + 5);
    ctx.strokeStyle = 'rgba(0,0,0,.68)'; ctx.lineWidth = radius * 2.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = metal; ctx.lineWidth = radius * 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x + nx * 1.5, a.y + ny * 1.5); ctx.lineTo(b.x + nx * 1.5, b.y + ny * 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.25; ctx.stroke();
    ctx.restore();
  }

  renderGoalNetPanel(ctx, corners, rows, cols) {
    const mix = (a, b, t) => a + (b - a) * t;
    const at = (u, v) => this.projectGoal3D(
      mix(mix(corners[0][0],corners[1][0],u),mix(corners[3][0],corners[2][0],u),v),
      mix(mix(corners[0][1],corners[1][1],u),mix(corners[3][1],corners[2][1],u),v),
      mix(mix(corners[0][2],corners[1][2],u),mix(corners[3][2],corners[2][2],u),v));
    ctx.save(); ctx.strokeStyle = 'rgba(207,231,236,.5)'; ctx.lineWidth = .72;
    for (let c=0;c<=cols;c++) { ctx.beginPath(); for(let r=0;r<=rows;r++){const p=at(c/cols,r/rows);if(!r)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);} ctx.stroke(); }
    for (let r=0;r<=rows;r++) { ctx.beginPath(); for(let c=0;c<=cols;c++){const p=at(c/cols,r/rows);if(!c)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);} ctx.stroke(); }
    ctx.restore();
  }

  renderAnimeNet(ctx) {
    const pointAt = (r, c) => {
      const n = this.netNodes[r][c];
      return this.projectGoal3D(n.x, n.y, n.depth);
    };
    const rearTL = this.projectGoal3D(.16, 2.39, 1.8), rearTR = this.projectGoal3D(7.16, 2.39, 1.8);
    const rearBL = this.projectGoal3D(.16, .04, 1.8), rearBR = this.projectGoal3D(7.16, .04, 1.8);
    ctx.save();
    const shade = ctx.createLinearGradient(rearTL.x, rearTL.y, rearBL.x, rearBL.y);
    shade.addColorStop(0, 'rgba(2,10,19,.76)'); shade.addColorStop(.6, 'rgba(3,19,25,.46)'); shade.addColorStop(1, 'rgba(4,20,17,.32)');
    ctx.fillStyle = shade; ctx.beginPath(); ctx.moveTo(rearTL.x,rearTL.y); ctx.lineTo(rearTR.x,rearTR.y); ctx.lineTo(rearBR.x,rearBR.y); ctx.lineTo(rearBL.x,rearBL.y); ctx.closePath(); ctx.fill();

    // Deformable 3D back net: each knot carries position, velocity, spring tension and damping.
    for (let c = 0; c <= this.netCols; c++) {
      ctx.beginPath();
      for (let r = 0; r <= this.netRows; r++) { const p = pointAt(r,c); if (!r) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }
      ctx.strokeStyle = c % 4 === 0 ? 'rgba(232,247,250,.7)' : 'rgba(175,214,223,.42)'; ctx.lineWidth = c % 4 === 0 ? .9 : .58; ctx.stroke();
    }
    for (let r = 0; r <= this.netRows; r++) {
      ctx.beginPath();
      for (let c = 0; c <= this.netCols; c++) { const p = pointAt(r,c); if (!c) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }
      ctx.strokeStyle = r % 2 === 0 ? 'rgba(232,247,250,.6)' : 'rgba(175,214,223,.34)'; ctx.lineWidth = r % 2 === 0 ? .8 : .55; ctx.stroke();
    }

    // Roof, floor, and side curtains connect the back mesh to the front frame in real depth.
    this.renderGoalNetPanel(ctx, [[0,2.44,0],[0,2.39,1.8],[.16,.04,1.8],[0,0,0]], 7, 5);
    this.renderGoalNetPanel(ctx, [[7.32,2.44,0],[7.32,0,0],[7.16,.04,1.8],[7.16,2.39,1.8]], 7, 5);
    this.renderGoalNetPanel(ctx, [[0,2.44,0],[7.32,2.44,0],[7.16,2.39,1.8],[.16,2.39,1.8]], 11, 5);
    this.renderGoalNetPanel(ctx, [[0,0,0],[.16,.04,1.8],[7.16,.04,1.8],[7.32,0,0]], 11, 4);
    ctx.restore();
  }

  renderAnimePosts(ctx) {
    const p = (x, y, z = 0) => this.projectGoal3D(x, y, z);
    const frame = [
      [p(0,0),p(0,2.44)],[p(0,2.44),p(7.32,2.44)],[p(7.32,2.44),p(7.32,0)],
      [p(0,2.44),p(.16,2.39,1.8)],[p(7.32,2.44),p(7.16,2.39,1.8)],
      [p(0,0),p(.16,.04,1.8)],[p(7.32,0),p(7.16,.04,1.8)],
      [p(.16,.04,1.8),p(.16,2.39,1.8)],[p(.16,2.39,1.8),p(7.16,2.39,1.8)],
      [p(7.16,2.39,1.8),p(7.16,.04,1.8)],[p(.16,.04,1.8),p(7.16,.04,1.8)]
    ];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.56)'; ctx.beginPath(); ctx.ellipse(200, this.goal.y + this.goal.h + 4, 178, 9, 0, 0, Math.PI*2); ctx.fill();
    // Metal sockets are flush with the grass at every upright support.
    for (const [x,z] of [[0,0],[7.32,0],[.16,1.8],[7.16,1.8]]) {
      const foot = p(x,.02,z);
      ctx.save(); ctx.translate(foot.x,0); ctx.scale(1/1.5,1); ctx.translate(-foot.x,0);
      ctx.fillStyle = 'rgba(4,13,19,.94)'; ctx.strokeStyle = 'rgba(195,216,221,.9)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(foot.x,foot.y+1,8+z,3.1,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#dce8eb'; ctx.beginPath(); ctx.arc(foot.x,foot.y,1,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    for (const [a,b] of frame) this.drawGoalTube(ctx,a,b);
    ctx.restore();
  }

  renderAnimeTargetDials(ctx) {
    this.TARGET_ZONES.forEach(z => {
      const isSelected = this.activeZone && this.activeZone.id === z.id;
      const isHovered = this.hoverZone && this.hoverZone.id === z.id;

      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.scale(1 / 1.5, 1);

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

    if (this.isOnlineMode && this.onlineGoalkeeperId && window.GOALKEEPER_ROSTER) {
      window.GOALKEEPER_ROSTER.draw(
        ctx, this.onlineGoalkeeperId, k.x, k.y, 1, this.timer || 0,
        k.diving, k.rotation, k.diveProgress, k.anticipating, k.diveDirection, k.state, k.landingTimer,
        this.onlineVisualIsGoal === false && this.ball?.selectedZone
          ? { x: this.ball.targetX, y: this.ball.targetY }
          : null
      );
      return;
    }

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

  setOnlineGoalkeeper(id) {
    const roster = window.GOALKEEPER_ROSTER;
    this.onlineGoalkeeperId = roster ? roster.byId(id).id : 'rookie';
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

    // The shadow stays on the turf while the ball rises toward the goal.
    const flight = b.inFlight ? b.progress : 0;
    const shadowX = b.startX + (b.targetX - b.startX) * flight;
    const shadowY = b.inFlight ? b.startY + (b.targetY - b.startY) * flight * .12 + 18 : b.y + b.radius * b.scale * .72;
    const shadowScale = b.inFlight ? .82 + flight * .24 : .92;
    ctx.globalAlpha = b.inFlight ? .25 - flight * .09 : b.inNet ? .16 : .24;
    ctx.fillStyle = '#02070a';
    ctx.filter = 'blur(5px)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, b.radius * b.scale * shadowScale, b.radius * b.scale * .3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    ctx.translate(b.x, b.y);
    ctx.scale(b.scale, b.scale);
    ctx.rotate(b.rotation);
    const radius = b.radius;

    // A layered, shaded football with stitched panels replaces the flat white token.
    const sphere = ctx.createRadialGradient(-radius * .38, -radius * .46, radius * .06, 0, 0, radius * 1.12);
    sphere.addColorStop(0, '#ffffff');
    sphere.addColorStop(.38, '#f1f7fa');
    sphere.addColorStop(.78, '#9dafbb');
    sphere.addColorStop(1, '#243543');
    ctx.fillStyle = sphere;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, radius - 1, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(22,40,53,.7)'; ctx.lineWidth = 1.25;
    ctx.fillStyle = '#132333';
    const polygon = (cx, cy, r, sides, angle = 0, fill = '#132333') => {
      ctx.fillStyle = fill; ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = angle + i * Math.PI * 2 / sides;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    polygon(0, 0, radius * .31, 5, -Math.PI / 2, '#102235');
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
      polygon(Math.cos(angle) * radius * .72, Math.sin(angle) * radius * .72, radius * .2, 5, angle, i % 2 ? '#172d40' : '#0e2132');
    }
    ctx.strokeStyle = 'rgba(18,38,53,.7)'; ctx.lineWidth = .8;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius * .31, Math.sin(angle) * radius * .31);
      ctx.lineTo(Math.cos(angle) * radius * .51, Math.sin(angle) * radius * .51);
      ctx.stroke();
    }
    const sheen = ctx.createRadialGradient(-radius * .45, -radius * .54, 0, -radius * .35, -radius * .45, radius * .8);
    sheen.addColorStop(0, 'rgba(255,255,255,.48)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.strokeStyle = b.inFlight ? 'rgba(255,248,216,.95)' : 'rgba(225,241,247,.9)';
    ctx.lineWidth = b.inFlight ? 2.6 : 2;
    ctx.shadowColor = b.inFlight ? 'rgba(255,180,59,.75)' : 'rgba(220,245,255,.4)';
    ctx.shadowBlur = b.inFlight ? 11 : 4;
    ctx.beginPath(); ctx.arc(0, 0, radius - 1, 0, Math.PI * 2); ctx.stroke();
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
    const age = this.feedbackAge || 0;
    const burstProgress = Math.min(1, age / 0.52);
    ctx.save();
    ctx.translate(200, 285);
    ctx.scale(this.feedbackScale, this.feedbackScale);
    ctx.globalAlpha = Math.max(0, this.feedbackAlpha);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.72 * (1 - burstProgress);
    ctx.rotate(age * 0.7);
    ctx.beginPath();
    ctx.arc(0, 0, 44 + burstProgress * 122, 0, Math.PI * 2);
    ctx.strokeStyle = this.feedbackColor;
    ctx.lineWidth = 8 * (1 - burstProgress) + 1;
    ctx.shadowColor = this.feedbackColor;
    ctx.shadowBlur = 24;
    ctx.stroke();
    for (let ray = 0; ray < 14; ray++) {
      const angle = (Math.PI * 2 * ray) / 14 + age * 0.35;
      const inner = 112 + (ray % 3) * 9;
      const outer = inner + 28 + (1 - burstProgress) * 28;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineWidth = ray % 2 ? 2 : 4;
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.rotate(-0.035);
    ctx.shadowColor = this.feedbackColor;
    ctx.shadowBlur = 24;
    const plate = ctx.createLinearGradient(0, -38, 0, 40);
    plate.addColorStop(0, 'rgba(17, 31, 49, 0.97)');
    plate.addColorStop(0.55, 'rgba(3, 12, 25, 0.97)');
    plate.addColorStop(1, 'rgba(9, 20, 35, 0.97)');
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.moveTo(-166, -38); ctx.lineTo(166, -38); ctx.lineTo(182, -22);
    ctx.lineTo(182, 23); ctx.lineTo(166, 39); ctx.lineTo(-166, 39);
    ctx.lineTo(-182, 23); ctx.lineTo(-182, -22); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.feedbackColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha *= 0.7;
    ctx.fillStyle = this.feedbackColor;
    ctx.beginPath();
    ctx.moveTo(-176, -25); ctx.lineTo(-166, -35); ctx.lineTo(-166, -12); ctx.lineTo(-176, -3); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(176, 25); ctx.lineTo(166, 35); ctx.lineTo(166, 12); ctx.lineTo(176, 3); ctx.closePath();
    ctx.fill();
    ctx.globalAlpha /= 0.7;

    ctx.fillStyle = this.feedbackColor;
    ctx.shadowColor = this.feedbackColor;
    ctx.shadowBlur = 16;
    ctx.font = '900 31px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.feedbackTitle, 0, -9, 320);

    if (this.feedbackSubtext) {
      ctx.fillStyle = '#f8fafc';
      ctx.shadowBlur = 0;
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.fillText(this.feedbackSubtext, 0, 17, 320);
    }
    ctx.restore();
    ctx.restore();
  }
}

window.PenaltisGame = PenaltisGame;
