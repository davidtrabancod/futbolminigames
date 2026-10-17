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
    // A slightly longer focal length brings the complete goal closer in the
    // camera while preserving its width-to-height ratio and net proportions.
    this.goalViewScale = 1.14;
    this.goalPixelsPerMeterX = 43.8 * this.goalViewScale;
    this.goalPixelsPerMeterY = 65.6 * this.goalViewScale;
    this.netDepth = 1.88;
    this.netPerspective = 1 / (1 + this.netDepth / 26.6);
    this.netGroundY = 287 + (310 - 287) * this.netPerspective;
    this.keeperRecoveryDuration = 1.2;
    const targetOnNet = (worldX, worldY) => ({
      x: 200 + (worldX - 3.66) * this.goalPixelsPerMeterX * this.netPerspective,
      y: this.netGroundY - worldY * this.goalPixelsPerMeterY * this.netPerspective
    });

    // Las 5 Zonas de Disparo Táctico
    this.TARGET_ZONES = [
      { id: 'top-left', name: 'Escuadra Izq.', shotName: '¡TIRO CON EFECTO! 🌪️', ...targetOnNet(.78, 2.02) },
      { id: 'top-right', name: 'Escuadra Der.', shotName: '¡TIRO DEL HALCÓN! 🦅', ...targetOnNet(6.54, 2.02) },
      { id: 'center', name: 'Centro Misil', shotName: '¡TIRO DEL TIGRE! 🐯🔥', ...targetOnNet(3.66, 1.22) },
      { id: 'bottom-left', name: 'Raso Izq.', shotName: '¡TIRO RASANTE! ⚡', ...targetOnNet(.78, .48) },
      { id: 'bottom-right', name: 'Raso Der.', shotName: '¡TIRO CORTADO! 🌪️', ...targetOnNet(6.54, .48) }
    ];

    this.currentLevel = ARENA_LEVEL;
    this.isOnlineMode = false;
    this.onlineRole = null;
    this.onOnlineActionSubmit = null;

    this.initNetMesh();
    this.initArenaAtmosphere();
    try {
      this.goal3D = new window.Goal3DRenderer(this.vWidth, this.vHeight);
    } catch (error) {
      console.warn('No se pudo iniciar el modelo 3D de la portería:', error);
      this.goal3D = null;
    }

    try {
      this.football3D = new window.Football3DRenderer(this.vWidth, this.vHeight);
    } catch (error) {
      console.warn('No se pudo iniciar el modelo 3D del balÃ³n:', error);
      this.football3D = null;
    }

    this.auraParticles = [];
    this.speedLines = [];
    this.ballFireTrail = [];
    this.goalFlares = [];
    this.goalFlareSparks = [];

    this.camera = {
      zoom: 1.0,
      targetZoom: 1.0,
      shake: 0
    };

    this.reset();
  }

  initArenaAtmosphere() {
    this.arenaBackground = new Image();
    this.arenaBackground.src = './assets/penalty-stadium-perspective.png';
    this.stadiumAdItems = [];
    this.setStadiumAds([
      { text: 'PENALTY RUSH', color: '#facc15' },
      { text: 'TU PATROCINIO AQU\u00cd', color: '#67e8f9' },
      { text: 'TU IMAGEN O MARCA', color: '#86efac' }
    ]);
    this.fireSprite = new Image();
    this.fireSprite.src = './assets/brazier-flame-sprite.png';
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

  // Pass strings or { text, color } / { src, alt, color } entries to create
  // a moving LED sponsor ribbon. Image files should be served by this site.
  setStadiumAds(items = []) {
    this.stadiumAdItems = (Array.isArray(items) ? items : []).map((entry, index) => {
      const ad = typeof entry === 'string' ? { text: entry } : (entry || {});
      const item = {
        text: String(ad.text || ''),
        alt: String(ad.alt || ad.text || `Patrocinador ${index + 1}`),
        color: ad.color || ['#facc15', '#67e8f9', '#86efac'][index % 3],
        image: ad.image || null,
        width: 0
      };
      if (!item.image && ad.src) {
        item.image = new Image();
        item.image.src = ad.src;
      }
      item.width = item.image ? 150 : Math.max(125, Math.min(270, item.text.length * 9 + 36));
      return item;
    });
  }

  // --- MÉTODOS ONLINE ---
  setOnlineMode(matchData, onSubmitAction) {
    this.isOnlineMode = true;
    this.onOnlineActionSubmit = onSubmitAction;

    this.onlineMyHistory = [];
    this.onlineOppHistory = [];
    this.onlineMyScore = 0;
    this.onlineOppScore = 0;
    this.pendingOnlineScoreboard = null;
    this.state = 'aiming';

    this.reset();
  }

  setOnlineTurn(turnMessage) {
    if (this.isOnlineMode && this.ball?.inFlight) {
      this.pendingOnlineTurn = turnMessage;
      return;
    }
    this.pendingOnlineTurn = null;
    const recoveringKeeper = ['saved', 'beaten'].includes(this.keeper.state)
      && this.keeper.landingTimer < this.keeperRecoveryDuration;
    this.onlineRole = turnMessage.role === 'shooter' ? 'lanzador' : 'portero';
    this.state = 'aiming';
    this.activeZone = null;
    this.hoverZone = null;
    this.ball.inFlight = false;
    this.ball.inNet = false;
    this.ball.velocityX = this.ball.velocityY = 0;
    this.ball.isDeflected = false;
    this.ball.physicsState = null;
    this.ball.physicsAccumulator = 0;
    this.ball.deflectStartScale = 1;
    this.ball.netAccumulator = 0;
    this.ball.deflectAccumulator = 0;
    this.ball.scale = 1;
    this.ball.progress = 0;
    this.ball.rotation = 0;
    this.ball.netAge = 0;
    this.ball.result = null;
    this.ball.selectedZone = null;
    this.keeper.catchContactTimer = 0;
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
    this.ball.flightTime = 0.52;
    this.launchAnimeShot(targetZone, keeperZoneId);
  }

  commitPendingOnlineScoreboard() {
    if (!this.pendingOnlineScoreboard) return;
    const scores = this.pendingOnlineScoreboard;
    this.onlineMyScore = scores.myScore;
    this.onlineOppScore = scores.oppScore;
    this.onlineMyShotsTotal = scores.myShotsTotal;
    this.onlineOppShotsTotal = scores.oppShotsTotal;
    this.pendingOnlineScoreboard = null;
  }
  // ----------------------

  initNetMesh() {
    this.netCols = 32;
    this.netRows = 16;
    this.netNodes = [];
    this.netConstraints = [];
    this.netPhysicsAccumulator = 0;

    // The rear panel hangs between two outside corner struts. Its top edge is
    // free between the corner anchors, so the net has a little natural slack.
    const netLeft = .16, netRight = 7.16, netBottom = .08, netTop = 2.36;
    const netRestDepth = this.netDepth;
    for (let r = 0; r <= this.netRows; r++) {
      this.netNodes[r] = [];
      for (let c = 0; c <= this.netCols; c++) {
        const u = c / this.netCols;
        const v = r / this.netRows;
        const x = netLeft + u * (netRight - netLeft);
        const y = netBottom + (1 - v) * (netTop - netBottom)
          - 0.13 * Math.sin(Math.PI * u) * (1 - v);
        this.netNodes[r][c] = {
          origX: x,
          origY: y,
          x,
          y,
          depth: netRestDepth,
          origDepth: netRestDepth,
          vx: 0,
          vy: 0,
          vz: 0,
          invMass: (r === this.netRows || c === 0 || c === this.netCols
            || (r === 0 && (c === 0 || c === this.netCols))) ? 0 : 1,
          prevX: x,
          prevY: y,
          prevDepth: netRestDepth
        };
      }
    }

    // Structural, shear and bending distance constraints keep the woven
    // panel taut while allowing a local impact pocket to travel through it.
    const addConstraint = (r1, c1, r2, c2, stiffness) => {
      const a = this.netNodes[r1][c1], b = this.netNodes[r2][c2];
      this.netConstraints.push({ a, b,
        rest: Math.hypot(a.origX - b.origX, a.origY - b.origY, a.origDepth - b.origDepth),
        stiffness
      });
    };
    for (let r = 0; r <= this.netRows; r++) for (let c = 0; c <= this.netCols; c++) {
      if (c < this.netCols) addConstraint(r, c, r, c + 1, .82);
      if (r < this.netRows) addConstraint(r, c, r + 1, c, .82);
      if (r < this.netRows && c < this.netCols) addConstraint(r, c, r + 1, c + 1, .14);
      if (r < this.netRows && c > 0) addConstraint(r, c, r + 1, c - 1, .14);
      if (c + 2 <= this.netCols) addConstraint(r, c, r, c + 2, .025);
      if (r + 2 <= this.netRows) addConstraint(r, c, r + 2, c, .025);
    }
    // The cloth starts at rest. Do not run the constraint solver until a shot
    // actually excites the net.
    this.netPhysicsActive = false;
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
      y: 150,
      w: 320,
      h: 160,
      postWidth: 12
    };

    const lvl = this.currentLevel;
    this.keeper = {
      x: 200,
      y: 270,
      baseX: 200,
      baseY: 270,
      targetX: 200,
      targetY: 270,
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
      diveStartY: 270,
      recoveryStartX: 200,
      recoveryStartY: 270,
      recoveryStartRotation: 0,
      anticipating: false,
      catchContactTimer: 0,
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
      radius: 29,
      scale: 1.0,
      deflectStartScale: 1.0,
      targetX: 200,
      targetY: 200,
      progress: 0,
      flightTime: 0.52,
      rotation: 0,
      spin: 0,
      physicsState: null,
      physicsAccumulator: 0,
      netAccumulator: 0,
      deflectAccumulator: 0,
      flightVX: 0,
      flightVY: 0,
      isDeflected: false,
      deflectAge: 0,
      contactHold: 0,
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
    this.netImpactPoint = null;

    this.camera.zoom = 1.0;
    this.camera.targetZoom = 1.0;
    this.camera.shake = 0;

    this.auraParticles = [];
    this.speedLines = [];
    this.ballFireTrail = [];
    this.goalFlares = [];
    this.goalFlareSparks = [];
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
    const boxX = 135, boxY = 4, boxW = 690, boxH = 78;
    const centerX = boxX + boxW / 2;
    const myName = (this.onlineMyName || 'TU').toUpperCase();
    const oppName = (this.onlineOppName || 'RIVAL').toUpperCase();
    const myScore = this.onlineMyScore ?? 0;
    const oppScore = this.onlineOppScore ?? 0;
    const myHistory = this.onlineMyHistory || [];
    const oppHistory = this.onlineOppHistory || [];
    const roundLabel = this.onlineRoundLabel || 'RONDA 1 / 3';
    const suddenDeath = this.onlineMyShotsTotal > 3 || this.onlineOppShotsTotal > 3
      || (myHistory.length >= 3 && oppHistory.length >= 3 && myScore === oppScore);
    const pulse = .5 + .5 * Math.sin(this.timer * 3.2);
    const panelPath = inset => {
      const x = boxX + inset, y = boxY + inset;
      const w = boxW - inset * 2, h = boxH - inset * 2, cut = Math.max(7, 16 - inset * .4);
      ctx.beginPath();
      ctx.moveTo(x + cut, y);
      ctx.lineTo(x + w - cut, y);
      ctx.lineTo(x + w, y + cut);
      ctx.lineTo(x + w, y + h - cut);
      ctx.lineTo(x + w - cut, y + h);
      ctx.lineTo(x + cut, y + h);
      ctx.lineTo(x, y + h - cut);
      ctx.lineTo(x, y + cut);
      ctx.closePath();
    };

    // Deep glass panel, layered edge light and a traveling polished highlight.
    ctx.shadowColor = 'rgba(25, 226, 238, .56)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 5;
    const background = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    background.addColorStop(0, 'rgba(10, 25, 39, .98)');
    background.addColorStop(.48, 'rgba(11, 17, 35, .98)');
    background.addColorStop(1, 'rgba(4, 11, 20, .98)');
    ctx.fillStyle = background;
    panelPath(0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(86, 244, 255, ' + (.52 + pulse * .3) + ')';
    ctx.lineWidth = 2;
    panelPath(0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1;
    panelPath(4);
    ctx.stroke();

    // Opposing team colors sit beneath the glass surface.
    ctx.save();
    panelPath(3);
    ctx.clip();
    const leftWash = ctx.createLinearGradient(boxX, 0, centerX, 0);
    leftWash.addColorStop(0, 'rgba(0, 203, 255, .2)');
    leftWash.addColorStop(1, 'rgba(0, 203, 255, 0)');
    ctx.fillStyle = leftWash;
    ctx.fillRect(boxX, boxY, boxW / 2, boxH);
    const rightWash = ctx.createLinearGradient(boxX + boxW, 0, centerX, 0);
    rightWash.addColorStop(0, 'rgba(255, 55, 100, .2)');
    rightWash.addColorStop(1, 'rgba(255, 55, 100, 0)');
    ctx.fillStyle = rightWash;
    ctx.fillRect(centerX, boxY, boxW / 2, boxH);
    ctx.restore();

    // Team-colored light rails frame the two score columns.
    const rail = (x, color, direction) => {
      const length = 174;
      const railX = direction > 0 ? x : x - length;
      const gradient = ctx.createLinearGradient(x, 0, x + direction * length, 0);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(railX, boxY + 6, length, 3);
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = color;
      ctx.fillRect(direction > 0 ? x : x - 42, boxY + 6, 42, 3);
      ctx.restore();
    };
    rail(boxX + 8, '#32dcff', 1);
    rail(boxX + boxW - 8, '#ff658b', -1);

    const sweepX = boxX + 20 + ((this.timer * .32) % 1) * (boxW - 40);
    ctx.save();
    panelPath(5);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const sweep = ctx.createLinearGradient(sweepX - 30, boxY, sweepX + 30, boxY);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(.5, 'rgba(185,248,255,.12)');
    sweep.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(boxX + 5, boxY + 4, boxW - 10, boxH - 8);
    ctx.restore();

    // Center seam and illuminated VS jewel.
    ctx.strokeStyle = 'rgba(255,255,255,.13)';
    ctx.beginPath();
    ctx.moveTo(centerX, boxY + 13);
    ctx.lineTo(centerX, boxY + boxH - 9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(6, 22, 32, .96)';
    ctx.strokeStyle = 'rgba(255, 214, 102, .78)';
    ctx.lineWidth = 1.3;
    ctx.save();
    ctx.translate(centerX, boxY + 26);
    ctx.rotate(Math.sin(this.timer * 1.8) * .08);
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(18, 0); ctx.lineTo(0, 18); ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = '#ffd866';
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#ffe68a';
    ctx.font = '800 9px Bungee, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Player names and large score digits.
    ctx.font = '700 12px "Chakra Petch", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8deeff';
    ctx.shadowColor = '#20cfff';
    ctx.shadowBlur = 8;
    ctx.fillText(myName, boxX + 208, boxY + 20, 230);
    ctx.fillStyle = '#ffadbd';
    ctx.shadowColor = '#ff4e77';
    ctx.fillText(oppName, boxX + boxW - 208, boxY + 20, 230);
    ctx.shadowBlur = 0;

    const drawScore = (score, x, color, pulseStart) => {
      let scale = 1;
      if (pulseStart !== undefined) {
        const age = this.timer - pulseStart;
        if (age >= 0 && age < .55) scale += Math.sin((1 - age / .55) * Math.PI) * .2;
      }
      ctx.save();
      ctx.translate(x, boxY + 54);
      ctx.scale(scale, scale);
      ctx.font = 'italic 900 59px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, .7)';
      ctx.strokeText(String(score), 0, 0);
      ctx.shadowColor = color;
      ctx.shadowBlur = 18 + pulse * 5;
      ctx.fillStyle = '#f4fbff';
      ctx.fillText(String(score), 0, 0);
      ctx.restore();
    };
    if (this._scoreboardMyScore !== undefined && this._scoreboardMyScore !== myScore) this._scorePulseMy = this.timer;
    if (this._scoreboardOppScore !== undefined && this._scoreboardOppScore !== oppScore) this._scorePulseOpp = this.timer;
    this._scoreboardMyScore = myScore;
    this._scoreboardOppScore = oppScore;
    drawScore(myScore, boxX + 208, '#25d9ff', this._scorePulseMy);
    drawScore(oppScore, boxX + boxW - 208, '#ff5478', this._scorePulseOpp);

    const suddenDeathLabel = suddenDeath;
    const roundWidth = suddenDeathLabel ? 142 : 126;
    ctx.fillStyle = suddenDeathLabel ? 'rgba(88, 54, 12, .94)' : 'rgba(8, 36, 49, .96)';
    ctx.strokeStyle = suddenDeathLabel ? 'rgba(255, 202, 89, .88)' : 'rgba(86, 224, 242, .62)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(centerX - roundWidth / 2, boxY + 61, roundWidth, 17, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = suddenDeathLabel ? '#ffe08b' : '#8beaf4';
    ctx.font = '800 11px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(roundLabel, centerX, boxY + 69.5, roundWidth - 10);

    // Attempt lights; the sudden-death attempt has a gold rim.
    const drawAttempts = (history, startX, direction) => {
      const count = suddenDeath ? 4 : 3;
      for (let i = 0; i < count; i++) {
        const x = startX + direction * i * 20;
        const y = boxY + 64;
        const result = history[i];
        const color = result === 'goal' ? '#4cff9b' : result === 'saved' ? '#ff526e' : '#78909b';
        ctx.save();
        ctx.shadowColor = result ? color : 'transparent';
        ctx.shadowBlur = result ? 9 : 0;
        ctx.fillStyle = result ? color : 'rgba(214,241,248,.1)';
        ctx.strokeStyle = i === 3 ? '#ffd866' : result ? color : 'rgba(208,236,242,.42)';
        ctx.lineWidth = i === 3 ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.arc(x, y, i === 3 ? 5.6 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    };
    drawAttempts(myHistory, boxX + 34, 1);
    drawAttempts(oppHistory, boxX + boxW - 34, -1);
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

  beginKeeperRecovery() {
    const keeper = this.keeper;
    keeper.recovering = true;
    keeper.landingTimer = 0;
    keeper.recoveryStartX = keeper.x;
    keeper.recoveryStartY = keeper.y;
    keeper.recoveryStartRotation = keeper.rotation;
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
    this.ball.scale = 1;
    this.ball.deflectStartScale = 1;
    this.ball.targetX = zone.x;
    this.ball.targetY = zone.y;
    this.ball.selectedZone = zone;
    this.ball.result = null;
    this.ball.flightVX = 0;
    this.ball.flightVY = 0;
    this.ball.spin = (Math.random() < .5 ? -1 : 1) * (20 + Math.random() * 16);
    this.ball.physicsAccumulator = 0;
    this.ball.physicsState = this.createBallFlightPhysics(zone);

    if (window.soundManager.playAnimeShot) {
      window.soundManager.playAnimeShot();
    } else {
      window.soundManager.playKick();
    }

    // Keep the stadium and goal locked in place during the shot.
    this.camera.targetZoom = 1.0;
    this.camera.shake = 0;
    this.ball.isDeflected = false;
    this.ball.contactHold = 0;
    this.ball.physicsAccumulator = 0;
    this.ball.netAccumulator = 0;
    this.ball.deflectAccumulator = 0;
    this.keeper.catchContactTimer = 0;

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
    // The center target has no horizontal side. Forcing it to +1 sent the
    // keeper anchor left while selecting the right-dive sprite pose.
    this.keeper.diveDirection = Math.sign(chosenZone.x - this.keeper.baseX);
    // The detailed sprite's glove is high and wide from its foot anchor; the
    // canvas fallback uses a compact, rotated body with gloves near its pivot.
    const detailedKeeper = this.isOnlineMode && this.onlineGoalkeeperId && window.GOALKEEPER_ROSTER;
    const gloveReachX = detailedKeeper ? 77 : 64;
    this.keeper.targetX = chosenZone.x - this.keeper.diveDirection * gloveReachX;
    this.keeper.targetY = chosenZone.y + (detailedKeeper ? 77 : -2);
    this.keeper.diveStartX = this.keeper.x;
    this.keeper.diveStartY = this.keeper.y;
    this.keeper.diveProgress = 0;
    this.keeper.landingTimer = 0;
    this.keeper.anticipating = false;
    this.keeper.recovering = false;
    this.keeper.diving = false;
    this.keeper.state = 'idle';
    this.keeper.rotation = 0;
  }

  projectBallScale(depth) {
    const targetDepth = Math.max(.001, this.ball.physicsTargetDepth || this.netDepth);
    const depthRatio = Math.max(0, Math.min(1, Math.max(0, depth) / targetDepth));
    const perspective = 1 / (1 + Math.max(0, depth) / 26.6);
    // The stadium plate compresses physical depth, so give the ball a stronger
    // size cue as it travels away from the camera toward the goal plane.
    return perspective * (1 - .44 * depthRatio);
  }

  projectBallPhysics(state) {
    const depth = this.ball.physicsTargetDepth || 0;
    const depthRatio = depth > 0 ? Math.max(0, Math.min(1, state.z / depth)) : 0;
    const perspective = 1 / (1 + Math.max(0, state.z) / 26.6);
    const groundY = 517.2 + (this.netGroundY - 517.2) * depthRatio;
    return {
      x: 200 + state.x * this.goalPixelsPerMeterX * perspective,
      y: groundY - state.y * this.goalPixelsPerMeterY * perspective,
      scale: this.projectBallScale(state.z)
    };
  }

  integrateBallPhysics(state, step, spin) {
    const speed = Math.hypot(state.vx, state.vy, state.vz);
    const drag = .0095 * speed;
    const spinAtTime = spin * Math.exp(-.2 * state.time);
    // A vertical spin axis creates the familiar sideways Magnus curl.
    const magnus = .0037 * spinAtTime * .11 * speed;
    const ax = -drag * state.vx + magnus * (state.vz / Math.max(speed, .001));
    const ay = -9.81 - drag * state.vy;
    const az = -drag * state.vz - magnus * (state.vx / Math.max(speed, .001));
    state.vx += ax * step;
    state.vy += ay * step;
    state.vz += az * step;
    state.x += state.vx * step;
    state.y += state.vy * step;
    state.z += state.vz * step;
    state.time += step;
  }

  simulateBallEndpoint(initialVelocity, duration, spin) {
    const state = { x: 0, y: .11, z: 0,
      vx: initialVelocity[0], vy: initialVelocity[1], vz: initialVelocity[2], time: 0 };
    const fixedStep = 1 / 120;
    while (state.time < duration - 1e-8) {
      this.integrateBallPhysics(state, Math.min(fixedStep, duration - state.time), spin);
    }
    return [state.x, state.y, state.z];
  }

  solveThreeByThree(matrix, vector) {
    const rows = matrix.map((row, i) => [...row, vector[i]]);
    for (let col = 0; col < 3; col++) {
      let pivot = col;
      for (let row = col + 1; row < 3; row++) {
        if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
      }
      if (Math.abs(rows[pivot][col]) < 1e-8) return null;
      [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
      const divisor = rows[col][col];
      for (let j = col; j < 4; j++) rows[col][j] /= divisor;
      for (let row = 0; row < 3; row++) if (row !== col) {
        const factor = rows[row][col];
        for (let j = col; j < 4; j++) rows[row][j] -= factor * rows[col][j];
      }
    }
    return rows.map(row => row[3]);
  }

  createBallFlightPhysics(zone) {
    const duration = this.ball.flightTime;
    const targetPerspective = this.netPerspective;
    const targetDepth = this.netDepth;
    this.ball.physicsTargetDepth = targetDepth;
    const target = [
      (zone.x - 200) / (this.goalPixelsPerMeterX * targetPerspective),
      (this.netGroundY - zone.y) / (this.goalPixelsPerMeterY * targetPerspective),
      targetDepth
    ];
    const spin = this.ball.spin;
    let velocity = [
      target[0] / duration,
      (target[1] - .11 + 4.905 * duration * duration) / duration,
      target[2] / duration
    ];

    // Shooting method: solve the launch velocity against the same drag and
    // Magnus integration used in play, so every tactical target is reached
    // without bending the rendered path onto an unrelated scripted point.
    for (let iteration = 0; iteration < 7; iteration++) {
      const endpoint = this.simulateBallEndpoint(velocity, duration, spin);
      const error = target.map((value, axis) => value - endpoint[axis]);
      if (Math.hypot(...error) < .0005) break;
      const jacobian = [[], [], []];
      for (let axis = 0; axis < 3; axis++) {
        const trial = velocity.slice();
        trial[axis] += .02;
        const displaced = this.simulateBallEndpoint(trial, duration, spin);
        for (let row = 0; row < 3; row++) jacobian[row][axis] = (displaced[row] - endpoint[row]) / .02;
      }
      const correction = this.solveThreeByThree(jacobian, error);
      if (!correction) break;
      for (let axis = 0; axis < 3; axis++) velocity[axis] += correction[axis];
    }
    return { x: 0, y: .11, z: 0,
      vx: velocity[0], vy: velocity[1], vz: velocity[2], time: 0 };
  }

  advanceBallFlight(dt) {
    const ball = this.ball, state = ball.physicsState;
    if (!state) return;
    const previous = this.projectBallPhysics(state);
    const fixedStep = 1 / 120;
    ball.physicsAccumulator = Math.min(.1, (ball.physicsAccumulator || 0) + dt);
    let simulated = 0;
    const startTime = state.time;
    while (ball.physicsAccumulator >= fixedStep - 1e-8 && state.time < ball.flightTime) {
      const step = Math.min(fixedStep, ball.flightTime - state.time);
      this.integrateBallPhysics(state, step, ball.spin);
      ball.physicsAccumulator -= step;
      simulated += step;
      const projected = this.projectBallPhysics(state);
      ball.x = projected.x;
      ball.y = projected.y;
      ball.scale = projected.scale;
      ball.flightVX = (projected.x - previous.x) / Math.max(simulated, step);
      ball.flightVY = (projected.y - previous.y) / Math.max(simulated, step);
    }
    ball.progress = Math.min(1, state.time / ball.flightTime);
    ball.rotation += ball.spin * (Math.exp(-.2 * startTime) - Math.exp(-.2 * state.time)) / .2;

    if (state.time >= ball.flightTime - 1e-7) {
      ball.progress = 1;
      ball.x = ball.targetX;
      ball.y = ball.targetY;
      ball.scale = this.projectBallScale(this.ball.physicsTargetDepth);
    }
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

    if (Math.random() < dt * 7 && this.fireEmbers.length < 24) {
      const side = Math.random() < .5 ? 1 : -1;
      const sourceX = side > 0 ? 940 : 20;
      this.fireEmbers.push({
        x: sourceX + (Math.random() - .5) * 5,
        y: 276 + Math.random() * 5,
        vx: -side * (3 + Math.random() * 14) + (Math.random() - .5) * 7,
        vy: -(20 + Math.random() * 33),
        size: .45 + Math.random() * 1.15,
        life: .45 + Math.random() * .65,
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

    this.updateGoalFlares(dt);

    if (this.keeper.recovering) {
      if (this.keeper.catchContactTimer <= 0) {
        const keeper = this.keeper;
        keeper.diving = false;
        keeper.landingTimer += dt;
        const progress = Math.min(1, keeper.landingTimer / this.keeperRecoveryDuration);
        const eased = progress * progress * (3 - 2 * progress);
        keeper.x = keeper.recoveryStartX + (keeper.baseX - keeper.recoveryStartX) * eased;
        keeper.y = keeper.recoveryStartY + (keeper.baseY - keeper.recoveryStartY) * eased;
        keeper.rotation = keeper.recoveryStartRotation * (1 - eased);
        if (progress >= 1) {
          keeper.recovering = false;
          keeper.state = 'idle';
          keeper.rotation = 0;
          keeper.diveDirection = 0;
        }
      }
    } else if (this.state === 'aiming') {
      this.keeper.idleTimer += dt;
      this.keeper.x = this.keeper.baseX + Math.sin(this.keeper.idleTimer * 1.4) * 3.5;
      this.keeper.y = this.keeper.baseY + Math.abs(Math.cos(this.keeper.idleTimer * 2.1)) * 1.8;
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
      this.advanceBallFlight(dt);
      const t = this.ball.progress;

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
          // The authoritative result arrives before the animation. Reveal the
          // updated score only when the ball reaches the goal/keeper plane.
          this.commitPendingOnlineScoreboard();
          this.resolveOnlineVisualOutcomeDirect(this.onlineVisualTurnRole, this.onlineVisualIsGoal);
          this.state = 'aiming';
          if (this.pendingOnlineTurn) {
            const nextTurn = this.pendingOnlineTurn;
            this.pendingOnlineTurn = null;
            // Let the save/impact read on screen before the next online turn
            // resets the ball and keeper to their ready positions.
            setTimeout(() => this.setOnlineTurn(nextTurn), this.keeperRecoveryDuration * 1000);
          }
        }
      }
    }

    if (this.ball.inNet) {
      const ball = this.ball;
      ball.netAccumulator = Math.min(.1, ball.netAccumulator + dt);
      const step = 1 / 120;
      while (ball.netAccumulator >= step) {
        ball.netAge += step;
        if (ball.netAge < .105) {
          // The net first catches and compresses the ball; gravity takes over
          // only after the mesh has absorbed the incoming impulse.
          const catchDamping = Math.exp(-17 * step);
          ball.velocityX *= catchDamping;
          ball.velocityY *= catchDamping;
        } else {
          ball.velocityY += 640 * step;
        }
        ball.x += ball.velocityX * step;
        ball.y += ball.velocityY * step;
        ball.velocityX *= Math.exp(-3.2 * step);
        ball.velocityY *= Math.exp(-1.15 * step);
        ball.rotation += step * ball.spin;
        ball.spin *= Math.exp(-2.4 * step);
        const visibleRadius = ball.radius * ball.scale;
        const left = this.projectGoal3D(.16, .08, this.netDepth).x + visibleRadius;
        const right = this.projectGoal3D(7.16, .08, this.netDepth).x - visibleRadius;
        const bottom = this.projectGoal3D(3.66, .08, this.netDepth).y - visibleRadius;
        if (ball.x < left || ball.x > right) {
          ball.x = Math.max(left, Math.min(right, ball.x));
          ball.velocityX *= -.42;
        }
        if (ball.y > bottom) {
          ball.y = bottom;
          ball.velocityY *= -.34;
          if (Math.abs(ball.velocityY) < 20) ball.velocityY = 0;
        }
        ball.netAccumulator -= step;
        if (ball.netAge > 1.25) {
          ball.inNet = false;
          ball.velocityX = ball.velocityY = 0;
          break;
        }
      }
    }

    if (this.keeper.catchContactTimer > 0) {
      this.keeper.catchContactTimer = Math.max(0, this.keeper.catchContactTimer - dt);
    }

    if (this.ball.isDeflected) {
      const ball = this.ball;
      if (ball.contactHold > 0) {
        ball.contactHold = Math.max(0, ball.contactHold - dt);
      } else {
        ball.deflectAccumulator = Math.min(.1, ball.deflectAccumulator + dt);
        const step = 1 / 120;
        while (ball.deflectAccumulator >= step) {
          ball.deflectAge += step;
          ball.velocityY += 640 * step;
          ball.x += ball.velocityX * step;
          ball.y += ball.velocityY * step;
          ball.velocityX *= Math.exp(-1.8 * step);
          ball.rotation += step * ball.spin * 1.5;
          ball.spin *= Math.exp(-.9 * step);
          ball.deflectAccumulator -= step;
        }
        ball.scale = Math.min(1, ball.deflectStartScale + ball.deflectAge * .34);
        if (ball.deflectAge > .9 || ball.y > 410) ball.isDeflected = false;
      }
    }

    for (let i = this.ballFireTrail.length - 1; i >= 0; i--) {
      this.ballFireTrail[i].alpha -= dt * 4.5;
      this.ballFireTrail[i].radius *= 0.92;
      if (this.ballFireTrail[i].alpha <= 0) this.ballFireTrail.splice(i, 1);
    }
    this.stepNetPhysics(dt);

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

  stepNetPhysics(dt) {
    if (!this.netPhysicsActive) return;
    const fixedStep = 1 / 120;
    this.netPhysicsAccumulator = Math.min(.1, this.netPhysicsAccumulator + dt);
    let steps = 0;
    while (this.netPhysicsAccumulator >= fixedStep && steps < 12) {
      for (let r = 0; r <= this.netRows; r++) for (let c = 0; c <= this.netCols; c++) {
        const node = this.netNodes[r][c];
        node.prevX = node.x; node.prevY = node.y; node.prevDepth = node.depth;
        if (!node.invMass) continue;
        // A light restoring force lets the mesh settle back to its authored
        // sag instead of retaining tiny residual offsets after a goal.
        node.vx += (node.origX - node.x) * 4.5 * fixedStep;
        node.vy += (node.origY - node.y) * 4.5 * fixedStep;
        node.vz += (node.origDepth - node.depth) * 4.5 * fixedStep;
        node.x += node.vx * fixedStep;
        node.y += node.vy * fixedStep;
        node.depth += node.vz * fixedStep;
      }

      // Position Based Dynamics: repeated distance projections keep the net
      // from stretching numerically while its pinned perimeter stays on frame.
      for (let iteration = 0; iteration < 6; iteration++) {
        for (const constraint of this.netConstraints) {
          const { a, b } = constraint;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.depth - a.depth;
          const length = Math.hypot(dx, dy, dz);
          const inverseMass = a.invMass + b.invMass;
          if (length < 1e-6 || !inverseMass) continue;
          const correction = (length - constraint.rest) * constraint.stiffness / (length * inverseMass);
          if (a.invMass) {
            a.x += dx * correction * a.invMass;
            a.y += dy * correction * a.invMass;
            a.depth += dz * correction * a.invMass;
          }
          if (b.invMass) {
            b.x -= dx * correction * b.invMass;
            b.y -= dy * correction * b.invMass;
            b.depth -= dz * correction * b.invMass;
          }
        }
      }

      const damping = Math.exp(-3.2 * fixedStep);
      let settled = true;
      for (let r = 0; r <= this.netRows; r++) for (let c = 0; c <= this.netCols; c++) {
        const node = this.netNodes[r][c];
        if (!node.invMass) {
          node.x = node.origX; node.y = node.origY; node.depth = node.origDepth;
          node.vx = node.vy = node.vz = 0;
          continue;
        }
        // Keep edge cords inside the frame footprint; the hit response comes
        // from the net's depth and local bow, not from escaping sideways.
        node.x = Math.max(.16, Math.min(7.16, node.x));
        node.vx = (node.x - node.prevX) / fixedStep * damping;
        node.vy = (node.y - node.prevY) / fixedStep * damping;
        node.vz = (node.depth - node.prevDepth) / fixedStep * damping;
        const offset = Math.hypot(node.x - node.origX, node.y - node.origY, node.depth - node.origDepth);
        const speed = Math.hypot(node.vx, node.vy, node.vz);
        if (offset < .004 && speed < .025) {
          node.x = node.origX; node.y = node.origY; node.depth = node.origDepth;
          node.vx = node.vy = node.vz = 0;
        } else {
          settled = false;
        }
      }
      if (settled) {
        this.netImpactPoint = null;
        this.netPhysicsActive = false;
        this.netPhysicsAccumulator = 0;
        break;
      }
      this.netPhysicsAccumulator -= fixedStep;
      steps++;
    }
  }

  bulgeNet(impactX, impactY, physics = null) {
    this.netPhysicsActive = true;
    const impactSpeed = physics ? Math.hypot(physics.vx, physics.vy, physics.vz) : 8;
    const hitX = Math.max(0, Math.min(7.32,
      3.66 + (impactX - 200) / (this.goalPixelsPerMeterX * this.netPerspective)));
    const hitY = Math.max(0, Math.min(2.44,
      (this.netGroundY - impactY) / (this.goalPixelsPerMeterY * this.netPerspective)));
    const impulse = Math.max(2, Math.min(12, impactSpeed * .8));
    this.netImpactPoint = { x: hitX, y: hitY };
    for (let r = 0; r <= this.netRows; r++) {
      for (let c = 0; c <= this.netCols; c++) {
        const node = this.netNodes[r][c];
        const dx = node.origX - hitX;
        const dy = node.origY - hitY;
        const dist = Math.hypot(dx, dy);
        if (node.invMass && dist < 1.25) {
          const falloff = Math.exp(-(dist * dist) / .3);
          node.vz += impulse * falloff;
          // Depth alone is hard to read in this compressed stadium camera.
          // Let the woven panel fan outward around the contact point as the
          // ball drives it back, making the pocket visible without moving posts.
          const radialKick = impulse * falloff * .2 / Math.max(dist, .12);
          node.vx += dx * radialKick + (physics?.vx || 0) * falloff * .12;
          node.vy += dy * radialKick + (physics?.vy || 0) * falloff * .1;
        }
      }
    }
  }

  resolveOnlineVisualOutcomeDirect(turnRole, isGoal) {
    if (this.ball.selectedZone) {
      this.ball.x = this.ball.selectedZone.x;
      this.ball.y = this.ball.selectedZone.y;
    }
    this.ball.scale = this.projectBallScale(this.netDepth);
    this.camera.shake = 0;
    this.camera.targetZoom = 1.0;

    if (isGoal) {
      this.ball.inNet = true;
      this.ball.netAge = 0;
      this.ball.netAccumulator = 0;
      this.ball.velocityX = Math.max(-28, Math.min(28, this.ball.flightVX * .055));
      this.ball.velocityY = Math.max(-30, Math.min(30, this.ball.flightVY * .055));
      this.ball.result = 'goal';
      this.keeper.state = 'beaten';
      const physics = this.ball.physicsState;
      this.bulgeNet(this.ball.targetX, this.ball.targetY, physics);
      if (turnRole === 'shooter') {
        this.spawnCelebrationFlares();
      } else {
        // A rival goal must not inherit the tail of the player's celebration.
        this.goalFlares.length = 0;
        this.goalFlareSparks.length = 0;
      }

      if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
      window.soundManager.playNetSwish();
      window.soundManager.playGoal();
      window.soundManager.playCrowdCheer();

    } else {
      this.ball.result = 'saved';
      this.keeper.state = 'saved';
      this.keeper.diving = true;
      this.keeper.diveProgress = 1;
      this.keeper.catchContactTimer = .22;
      this.deflectBallFromKeeper();

      if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
      window.soundManager.playCatch();
      window.soundManager.playCrowdGroan();
    }

    this.beginKeeperRecovery();

    this.feedbackAlpha = 0;
    this.feedbackTitle = '';
    this.feedbackSubtext = '';
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
      this.keeper.diving = true;
      this.keeper.diveProgress = 1;
      this.keeper.catchContactTimer = .22;
      this.deflectBallFromKeeper();
      this.streak = 0;
      this.history.push('saved');
      this.camera.shake = 0;

      if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
      window.soundManager.playCatch();
      window.soundManager.playCrowdGroan();

      this.feedbackAlpha = 0;
      this.feedbackTitle = '';
      this.feedbackSubtext = '';
    } else {
      this.score += 100 + this.streak * 25;
      this.streak++;
      this.history.push('goal');
      this.triggerAnimeGoal();
    }

    this.beginKeeperRecovery();

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

    const finalShotHold = this.shotsTaken >= this.maxShots ? 2700 : 1900;
    setTimeout(() => {
      this.camera.targetZoom = 1.0;
      if (this.shotsTaken >= this.maxShots) {
        this.finishShootout();
      } else {
        this.resetNextShot();
      }
    }, finalShotHold);
  }

  triggerAnimeGoal() {
    this.ball.inNet = true;
    this.ball.netAge = 0;
    this.ball.netAccumulator = 0;
    this.ball.scale = this.projectBallScale(this.netDepth);
    this.ball.velocityX = Math.max(-28, Math.min(28, this.ball.flightVX * .055));
    this.ball.velocityY = Math.max(-30, Math.min(30, this.ball.flightVY * .055));
    this.ball.result = 'goal';
    this.keeper.state = 'beaten';

    this.camera.shake = 0;
    const physics = this.ball.physicsState;
    this.bulgeNet(this.ball.targetX, this.ball.targetY, physics);
    this.spawnCelebrationFlares();

    if (window.soundManager.playAnimeImpact) window.soundManager.playAnimeImpact();
    window.soundManager.playNetSwish();
    window.soundManager.playGoal();
    window.soundManager.playCrowdCheer();

    this.feedbackAlpha = 0;
  }

  deflectBallFromKeeper() {
    this.ball.isDeflected = true;
    this.ball.deflectAge = 0;
    this.ball.deflectStartScale = this.ball.scale;
    // Keep the ball pinned to the keeper's palms for several rendered frames
    // so the impact reads clearly before the rebound begins.
    this.ball.contactHold = .095;
    this.ball.velocityX = this.keeper.diveDirection * 62 + this.ball.flightVX * .08;
    this.ball.velocityY = Math.max(70, this.ball.flightVY * .06);
  }

  spawnCelebrationFlares() {
    const fireColors = ['#ff4d0a', '#ff7314', '#ff9f1c', '#ffc247', '#ffe0a0'];
    const launchX = [65, 155, 245, 335, 425, 515, 605, 695, 785, 875];
    for (let i = 0; i < launchX.length; i++) {
      const x = launchX[i] + (Math.random() - .5) * 30;
      const targetY = 38 + Math.random() * 92;
      const duration = .68 + Math.random() * .2;
      this.goalFlares.push({
        x, y: this.app.virtualHeight * .516 + 4,
        startX: x, startY: this.app.virtualHeight * .516 + 4,
        targetY, age: -i * .03, duration,
        phase: Math.random() * Math.PI * 2,
        hue: fireColors[i % fireColors.length], trail: []
      });
    }
  }

  updateGoalFlares(dt) {
    for (let i = this.goalFlares.length - 1; i >= 0; i--) {
      const flare = this.goalFlares[i];
      flare.age += dt;
      if (flare.age < 0) continue;
      const progress = Math.min(1, flare.age / flare.duration);
      const rise = 1 - Math.pow(1 - progress, 1.35);
      flare.x = flare.startX + Math.sin(flare.age * 7 + flare.phase) * (2 + progress * 4);
      flare.y = flare.startY + (flare.targetY - flare.startY) * rise;
      flare.trail.push({ x: flare.x, y: flare.y + 8, life: .42, size: 3 + Math.random() * 2.5 });
      for (let t = flare.trail.length - 1; t >= 0; t--) {
        flare.trail[t].life -= dt;
        if (flare.trail[t].life <= 0) flare.trail.splice(t, 1);
      }
      if (progress >= 1) {
        for (let spark = 0; spark < 38; spark++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 34 + Math.random() * 112;
          const sparkColor = ['#ff4d0a', '#ff8a12', '#ffc247', '#fff0bd'][Math.floor(Math.random() * 4)];
          this.goalFlareSparks.push({
            x: flare.x, y: flare.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 24,
            age: 0, life: .62 + Math.random() * .55,
            size: 1.2 + Math.random() * 2.4, hue: sparkColor
          });
        }
        this.goalFlares.splice(i, 1);
      }
    }
    for (let i = this.goalFlareSparks.length - 1; i >= 0; i--) {
      const spark = this.goalFlareSparks[i];
      spark.age += dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 105 * dt;
      if (spark.age >= spark.life) this.goalFlareSparks.splice(i, 1);
    }
  }

  renderGoalFlares(ctx) {
    if (!this.goalFlares.length && !this.goalFlareSparks.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const flare of this.goalFlares) {
      if (flare.age < 0) continue;
      for (const point of flare.trail) {
        const strength = point.life / .42;
        const ember = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.size * 2.6);
        ember.addColorStop(0, `rgba(255,246,205,${strength})`);
        ember.addColorStop(.2, `rgba(255,174,48,${strength * .95})`);
        ember.addColorStop(.62, `rgba(255,75,8,${strength * .48})`);
        ember.addColorStop(1, 'rgba(120,18,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = ember;
        ctx.shadowColor = '#ff7a13';
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, point.size * .72, point.size * 1.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // A tapered, flickering flame wraps the hot flare head instead of a
      // colored bead, with a white-yellow core and a translucent orange tail.
      const flameHeight = 32 + Math.sin(flare.age * 34 + flare.phase) * 6;
      const flameWidth = 6.5 + Math.sin(flare.age * 25 + flare.phase * 2) * 1.2;
      const flame = ctx.createLinearGradient(flare.x, flare.y - 4, flare.x, flare.y + flameHeight);
      flame.addColorStop(0, 'rgba(255,255,224,.98)');
      flame.addColorStop(.18, 'rgba(255,218,107,.98)');
      flame.addColorStop(.48, 'rgba(255,130,16,.94)');
      flame.addColorStop(1, 'rgba(220,38,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = flame;
      ctx.shadowColor = '#ff7414';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(flare.x, flare.y - 5);
      ctx.bezierCurveTo(flare.x - flameWidth * 1.5, flare.y + 2, flare.x - flameWidth, flare.y + flameHeight * .72, flare.x, flare.y + flameHeight);
      ctx.bezierCurveTo(flare.x + flameWidth * 1.1, flare.y + flameHeight * .67, flare.x + flameWidth * 1.35, flare.y + 2, flare.x, flare.y - 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,248,210,.96)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(flare.x, flare.y, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const spark of this.goalFlareSparks) {
      ctx.globalAlpha = Math.max(0, 1 - spark.age / spark.life);
      ctx.fillStyle = spark.hue;
      ctx.shadowColor = spark.hue;
      ctx.shadowBlur = 13;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  resetNextShot() {
    this.ball.x = this.ball.startX;
    this.ball.y = this.ball.startY;
    this.ball.scale = 1;
    this.ball.deflectStartScale = 1;
    this.ball.progress = 0;
    this.ball.result = null;
    this.ball.inFlight = false;
    this.ball.inNet = false;
    this.ball.isDeflected = false;
    this.ball.physicsState = null;
    this.ball.physicsAccumulator = 0;
    this.ball.netAccumulator = 0;
    this.ball.deflectAccumulator = 0;
    this.keeper.catchContactTimer = 0;
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
    this.renderPenaltyPitchDetails(ctx);
    if (this.goal3D) {
      try {
        this.goal3D.draw(this.netNodes, this.netImpactPoint);
        ctx.drawImage(this.goal3D.canvas, 0, 0, this.vWidth, this.vHeight);
      } catch (error) {
        console.warn('Se perdió el contexto 3D de la portería:', error);
        this.goal3D = null;
      }
    }
    if (!this.goal3D) {
      this.renderAnimePosts(ctx);
      this.renderAnimeNet(ctx);
    }

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


    ctx.restore();

    if (this.isOnlineMode) {
      this.renderOnlineRoleBanner(ctx);
      this.renderOnlineScoreboardOverlay(ctx);
    }
  }

  renderOnlineRoleBanner(ctx) {
    const isShooter = this.onlineRole === 'lanzador';
    const accent = isShooter ? '#ffd84d' : '#54ddff';
    const x = 365, y = 86, w = 230, h = 32;
    const midY = y + h / 2;
    ctx.save();

    ctx.shadowColor = accent;
    ctx.shadowBlur = 17;
    const panel = ctx.createLinearGradient(x, y, x, y + h);
    panel.addColorStop(0, 'rgba(14, 28, 43, .98)');
    panel.addColorStop(1, 'rgba(4, 12, 22, .98)');
    ctx.fillStyle = panel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = .8;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Icon medallion: target reticle for the shooter, shield for the keeper.
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath();
    ctx.arc(x + 23, midY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 7;
    if (isShooter) {
      ctx.beginPath();
      ctx.arc(x + 23, midY, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 23, midY, 2, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 23, midY - 10); ctx.lineTo(x + 23, midY - 8);
      ctx.moveTo(x + 23, midY + 8); ctx.lineTo(x + 23, midY + 10);
      ctx.moveTo(x + 13, midY); ctx.lineTo(x + 15, midY);
      ctx.moveTo(x + 31, midY); ctx.lineTo(x + 33, midY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 23, midY - 9);
      ctx.lineTo(x + 31, midY - 6);
      ctx.lineTo(x + 30, midY + 2);
      ctx.quadraticCurveTo(x + 28, midY + 8, x + 23, midY + 10);
      ctx.quadraticCurveTo(x + 18, midY + 8, x + 16, midY + 2);
      ctx.lineTo(x + 15, midY - 6);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.globalAlpha = .22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 19, midY); ctx.lineTo(x + 22, midY + 3);
      ctx.lineTo(x + 27, midY - 3);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(220,240,248,.72)';
    ctx.font = '700 8px "Chakra Petch", sans-serif';
    ctx.fillText('TU TURNO', x + 47, y + 9);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 9;
    ctx.font = '900 17px "Barlow Condensed", sans-serif';
    ctx.fillText(isShooter ? 'LANZADOR' : 'PORTERO', x + 47, y + 21);
    ctx.shadowBlur = 0;

    // A small animated charge bar tracks the pulse without competing with the score.
    const charge = (Math.sin(this.timer * 3.4) + 1) * .5;
    ctx.globalAlpha = .35 + charge * .5;
    ctx.fillStyle = accent;
    ctx.fillRect(x + w - 5, y + 8, 2, h - 16);
    ctx.globalAlpha = 1;
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
      const sourceStandLine = image.naturalHeight * .4676;
      const sourceGoalLine = image.naturalHeight * .5920;
      const outputStandLine = this.app.virtualHeight * .4676;
      const outputGoalLine = this.app.virtualHeight * .5167;
      // Compress only the far strip between the stands and the goal line.
      // The foreground turf keeps its perspective and texture scale.
      ctx.drawImage(image, 0, 0, image.naturalWidth, sourceStandLine,
        0, 0, this.app.virtualWidth, outputStandLine);
      ctx.drawImage(image, 0, sourceStandLine, image.naturalWidth, sourceGoalLine - sourceStandLine,
        0, outputStandLine, this.app.virtualWidth, outputGoalLine - outputStandLine);
      ctx.drawImage(image, 0, sourceGoalLine, image.naturalWidth, image.naturalHeight - sourceGoalLine,
        0, outputGoalLine, this.app.virtualWidth, this.app.virtualHeight - outputGoalLine);
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
    // Render behind the opaque LED boards so the rockets emerge from behind them.
    this.renderGoalFlares(ctx);

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
    this.renderStadiumAds(ctx);
  }

  renderStadiumAds(ctx) {
    const ads = this.stadiumAdItems;
    if (!ads?.length) return;

    const width = this.app.virtualWidth;
    const height = 30;
    const y = this.app.virtualHeight * .4533;
    const pad = 4;
    const separator = 42;
    const cycleWidth = ads.reduce((sum, ad) => sum + ad.width + separator, 0);
    const offset = (this.timer * 58) % cycleWidth;

    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 11;
    const shell = ctx.createLinearGradient(0, y, 0, y + height);
    shell.addColorStop(0, '#172833');
    shell.addColorStop(.45, '#07151d');
    shell.addColorStop(1, '#101c23');
    ctx.fillStyle = shell;
    ctx.fillRect(0, y, width, height);
    ctx.shadowBlur = 0;

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(103,232,249,.92)';
    ctx.strokeRect(.7, y + .7, width - 1.4, height - 1.4);
    ctx.fillStyle = 'rgba(250,204,21,.9)';
    ctx.fillRect(0, y, width, 1.5);
    ctx.fillRect(0, y + height - 1.5, width, 1.5);

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, y + 2, width - pad * 2, height - 4);
    ctx.clip();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 11px "Chakra Petch", "Arial Narrow", sans-serif';
    const firstCycleX = -offset;
    const cycles = Math.ceil(width / cycleWidth) + 1;
    for (let cycle = -1; cycle < cycles; cycle++) {
      let x = firstCycleX + cycle * cycleWidth;
      for (const ad of ads) {
        const centerX = x + ad.width / 2;
        const image = ad.image;
        if (image?.complete && image.naturalWidth) {
          const scale = Math.min((ad.width - 18) / image.naturalWidth, 18 / image.naturalHeight);
          const drawW = image.naturalWidth * scale;
          const drawH = image.naturalHeight * scale;
          ctx.drawImage(image, centerX - drawW / 2, y + (height - drawH) / 2, drawW, drawH);
        } else {
          ctx.fillStyle = ad.color;
          ctx.shadowColor = ad.color;
          ctx.shadowBlur = 5;
          ctx.fillText(ad.text || ad.alt, centerX, y + height / 2 + .5, ad.width - 12);
          ctx.shadowBlur = 0;
        }
        x += ad.width;
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 5;
        ctx.fillText('✦', x + separator / 2, y + height / 2);
        ctx.shadowBlur = 0;
        x += separator;
      }
    }
    ctx.restore();
    ctx.restore();
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
    const height = this.app.virtualHeight;
    const torches = [
      { x: 20, y: height * .46, direction: 1 },
      { x: this.app.virtualWidth - 20, y: height * .46, direction: -1 }
    ];
    for (const [index, torch] of torches.entries()) {
      const phase = this.timer * 6.2 + index * 2.4;
      const flicker = Math.sin(phase) * .045 + Math.sin(phase * 2.17) * .025;
      const { x: baseX, y: baseY, direction } = torch;

      // Small localized bounce light anchors the photographed flame to the brazier bowl.
      const glow = ctx.createRadialGradient(baseX, baseY - 4, 1, baseX, baseY - 4, 25);
      glow.addColorStop(0, `rgba(255,158,48,${.19 + flicker})`);
      glow.addColorStop(.4, `rgba(255,94,24,${.08 + flicker * .4})`);
      glow.addColorStop(1, 'rgba(255,65,14,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(baseX - 28, baseY - 30, 56, 34);

      if (this.fireSprite?.complete && this.fireSprite.naturalWidth > 0) {
        const sway = Math.sin(phase * .48) * .035 + direction * .018;
        const width = 36 * (1 + flicker * .65);
        const flameHeight = 56 * (1 + Math.sin(phase * .83) * .055);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = .92;
        ctx.translate(baseX, baseY);
        ctx.rotate(sway);
        ctx.drawImage(this.fireSprite, -width / 2, -flameHeight, width, flameHeight);
        ctx.restore();
      } else {
        // Short loading fallback; the transparent photographic sprite replaces it on load.
        const fallback = ctx.createLinearGradient(baseX, baseY, baseX, baseY - 28);
        fallback.addColorStop(0, 'rgba(255,93,22,.75)');
        fallback.addColorStop(.65, 'rgba(255,179,54,.84)');
        fallback.addColorStop(1, 'rgba(255,229,151,0)');
        ctx.fillStyle = fallback;
        ctx.beginPath();
        ctx.ellipse(baseX, baseY - 13, 4, 15, sway, 0, Math.PI * 2);
        ctx.fill();
      }
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
    const d = Math.max(0, depth);
    const perspective = 1 / (1 + d / 26.6);
    return {
      // Match the compressed field's vanishing point and goal-line height.
      x: 200 + (x - 3.66) * this.goalPixelsPerMeterX * perspective,
      y: 287 + (310 - y * this.goalPixelsPerMeterY - 287) * perspective
    };
  }

  projectNetNode(node) {
    const flex = node.depth - node.origDepth;
    return this.projectGoal3D(node.x, node.y, Math.max(0, node.depth + flex * .35));
  }

  drawGoalTube(ctx, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length, ny = dx / length, radius = 3.2;
    ctx.save();
    const metal = ctx.createLinearGradient(
      (a.x + b.x) * .5 - nx * radius, (a.y + b.y) * .5 - ny * radius,
      (a.x + b.x) * .5 + nx * radius, (a.y + b.y) * .5 + ny * radius);
    metal.addColorStop(0, '#344750'); metal.addColorStop(.18, '#b9cbd1');
    metal.addColorStop(.42, '#ffffff'); metal.addColorStop(.62, '#91a7af'); metal.addColorStop(1, '#344750');
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x + 1, a.y + 3); ctx.lineTo(b.x + 1, b.y + 3);
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = radius * 2.7; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = metal; ctx.lineWidth = radius * 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x + nx * 1.5, a.y + ny * 1.5); ctx.lineTo(b.x + nx * 1.5, b.y + ny * 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,.64)'; ctx.lineWidth = .9; ctx.stroke();
    ctx.restore();
  }

  drawGoalFramePath(ctx, points, width) {
    if (points.length < 2) return;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // One continuous path per frame keeps each upright and crossbar physically joined.
    trace();
    ctx.lineWidth = width * 1.75;
    ctx.strokeStyle = 'rgba(0,0,0,.58)';
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 3;
    ctx.stroke();

    trace();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = width;
    const metal = ctx.createLinearGradient(0, points[0].y, 0, points[1].y);
    metal.addColorStop(0, '#91a2a8');
    metal.addColorStop(.32, '#f5f8f8');
    metal.addColorStop(.68, '#c4d0d3');
    metal.addColorStop(1, '#65777d');
    ctx.strokeStyle = metal;
    ctx.stroke();

    trace();
    ctx.lineWidth = Math.max(.8, width * .16);
    ctx.strokeStyle = 'rgba(255,255,255,.58)';
    ctx.stroke();
    ctx.restore();
  }

  renderGoalNetPanel(ctx, corners, rows, cols) {
    const mix = (a, b, t) => a + (b - a) * t;
    const at = (u, v) => this.projectGoal3D(
      mix(mix(corners[0][0],corners[1][0],u),mix(corners[3][0],corners[2][0],u),v),
      mix(mix(corners[0][1],corners[1][1],u),mix(corners[3][1],corners[2][1],u),v),
      mix(mix(corners[0][2],corners[1][2],u),mix(corners[3][2],corners[2][2],u),v));
    ctx.save(); ctx.strokeStyle = 'rgba(207,231,236,.25)'; ctx.lineWidth = .55;
    for (let c=0;c<=cols;c++) { ctx.beginPath(); for(let r=0;r<=rows;r++){const p=at(c/cols,r/rows);if(!r)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);} ctx.stroke(); }
    for (let r=0;r<=rows;r++) { ctx.beginPath(); for(let c=0;c<=cols;c++){const p=at(c/cols,r/rows);if(!c)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);} ctx.stroke(); }
    ctx.restore();
  }

  renderAnimeNet(ctx) {
    const pointAt = (r, c) => this.projectNetNode(this.netNodes[r][c]);
    ctx.save();

    // This deformable net starts directly behind the integrated photo frame (z=0).
    for (let c = 0; c <= this.netCols; c++) {
      ctx.beginPath();
      for (let r = 0; r <= this.netRows; r++) { const p = pointAt(r,c); if (!r) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }
      ctx.strokeStyle = 'rgba(219,235,232,.3)'; ctx.lineWidth = .52; ctx.stroke();
    }
    for (let r = 0; r <= this.netRows; r++) {
      ctx.beginPath();
      for (let c = 0; c <= this.netCols; c++) { const p = pointAt(r,c); if (!c) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }
      ctx.strokeStyle = 'rgba(219,235,232,.26)'; ctx.lineWidth = .48; ctx.stroke();
    }

    // Roof, floor, and side curtains connect the back mesh to the front frame in real depth.
    this.renderGoalNetPanel(ctx, [[.12,2.38,0],[.12,2.36,1.8],[.16,.08,1.8],[.12,.06,0]], 7, 5);
    this.renderGoalNetPanel(ctx, [[7.2,2.38,0],[7.2,.06,0],[7.16,.08,1.8],[7.16,2.36,1.8]], 7, 5);
    this.renderGoalNetPanel(ctx, [[.12,2.38,0],[7.2,2.38,0],[7.16,2.36,1.8],[.16,2.36,1.8]], 11, 5);
    this.renderGoalNetPanel(ctx, [[.12,.06,0],[.16,.08,1.8],[7.16,.08,1.8],[7.2,.06,0]], 11, 4);
    ctx.restore();
  }

  renderAnimePosts(ctx) {
    const p = (x, y, z = 0) => this.projectGoal3D(x, y, z);
    const frontFrame = [p(0,0),p(0,2.44),p(7.32,2.44),p(7.32,0)];
    const rearSupports = [
      [p(.16,2.39,1.8),p(-.30,.035,2.02)],
      [p(7.16,2.39,1.8),p(7.62,.035,2.02)]
    ];
    const depthBraces = [
      [p(0,0),p(.16,.04,1.8)],[p(0,2.44),p(.16,2.39,1.8)],
      [p(7.32,0),p(7.16,.04,1.8)],[p(7.32,2.44),p(7.16,2.39,1.8)]
    ];
    ctx.save();
    // Canvas fallback for browsers without WebGL: draw a complete front frame.
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (const x of [p(0,0).x, p(7.32,0).x]) {
      ctx.beginPath(); ctx.ellipse(x, 328, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    this.drawGoalFramePath(ctx, frontFrame, 6.5);
    for (const [a,b] of rearSupports) this.drawGoalTube(ctx,a,b);
    for (const [a,b] of depthBraces) this.drawGoalTube(ctx,a,b);
    ctx.restore();
  }

  renderAnimeTargetDials(ctx) {
    this.TARGET_ZONES.forEach((z, index) => {
      const isSelected = this.activeZone && this.activeZone.id === z.id;
      const isHovered = this.hoverZone && this.hoverZone.id === z.id;

      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.scale(1 / 1.5, 1);

      const phase = this.timer * (isSelected ? 7 : 2.1) + index * 1.25;
      const breathe = (Math.sin(phase) + 1) * 0.5;
      const color = isSelected ? '#ffe66d' : isHovered ? '#55eaff' : '#effaff';
      const radius = (isSelected ? 22 : 18) + (isSelected ? breathe * 2.5 : breathe * 1.2);
      const alpha = isSelected ? 0.95 : isHovered ? 0.9 : 0.68;

      // Soft halo keeps the target legible against both net and crowd.
      ctx.globalAlpha = isSelected ? 0.2 + breathe * 0.12 : isHovered ? 0.16 : 0.07 + breathe * 0.035;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, radius + (isSelected ? 15 : 11), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 18 : isHovered ? 13 : 6;
      ctx.lineWidth = isSelected ? 2.6 : 1.8;
      ctx.strokeStyle = color;

      // Four separated arcs read as a precision aiming reticle, not a button.
      const arcGap = 0.18;
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        const start = quadrant * Math.PI / 2 + arcGap;
        ctx.beginPath();
        ctx.arc(0, 0, radius, start, start + Math.PI / 2 - arcGap * 2);
        ctx.stroke();
      }

      // Fine outer calibration marks and a slowly rotating scan highlight.
      ctx.shadowBlur = 0;
      ctx.globalAlpha = isSelected ? 0.72 : 0.38;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      for (let tick = 0; tick < 8; tick++) {
        const angle = tick * Math.PI / 4;
        const inner = radius + 3;
        const outer = radius + (tick % 2 === 0 ? 8 : 6);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
      ctx.save();
      ctx.rotate(phase * 0.22);
      ctx.globalAlpha = isSelected ? 0.95 : isHovered ? 0.72 : 0.34;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5, -0.48, 0.48);
      ctx.stroke();
      ctx.restore();

      // Center pin and a compact index identify each of the five shot lanes.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, isSelected ? 3.3 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = isSelected ? 1 : 0.78;
      ctx.font = '700 9px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1).padStart(2, '0'), 0, radius + 18);

      ctx.restore();
    });
  }

  renderCountryGoalkeeper(ctx) {
    const k = this.keeper;
    const lvl = this.currentLevel;
    const catching = this.ball?.result === 'saved' && k.catchContactTimer > 0;
    const divingPose = k.diving || catching;
    const contactPoint = catching && this.ball.selectedZone
      ? { x: this.ball.targetX, y: this.ball.targetY }
      : null;

    if (this.isOnlineMode && this.onlineGoalkeeperId && window.GOALKEEPER_ROSTER) {
      window.GOALKEEPER_ROSTER.draw(
        ctx, this.onlineGoalkeeperId, k.x, k.y, 1, this.timer || 0,
        divingPose, k.rotation, k.diveProgress, k.anticipating, k.diveDirection, k.state, k.landingTimer,
        contactPoint
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

    const span = divingPose ? 44 : 28;
    const gy = divingPose ? -48 : -14;
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

  renderNetContactOverlay(ctx, ball) {
    const radius = ball.radius * ball.scale;
    if (radius <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, radius * .98, 0, Math.PI * 2);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = Math.max(.48, 1 - ball.netAge / .34);
    const point = node => this.projectNetNode(node);
    // For the first fraction of a second after impact, let the strands cross
    // the ball silhouette: this makes the ball read as caught in the mesh.
    const drawStrands = () => {
      for (let r = 0; r <= this.netRows; r++) {
        ctx.beginPath();
        for (let c = 0; c <= this.netCols; c++) {
          const p = point(this.netNodes[r][c]);
          if (!c) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let c = 0; c <= this.netCols; c++) {
        ctx.beginPath();
        for (let r = 0; r <= this.netRows; r++) {
          const p = point(this.netNodes[r][c]);
          if (!r) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    };
    ctx.strokeStyle = 'rgba(4,12,17,.92)';
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 1.5;
    ctx.lineWidth = 2.3;
    drawStrands();
    ctx.strokeStyle = 'rgba(235,247,241,.96)';
    ctx.shadowColor = 'rgba(5,14,18,.8)';
    ctx.shadowBlur = 2;
    ctx.lineWidth = 1.1;
    drawStrands();
    ctx.restore();
  }

  renderAnimeBall(ctx) {
    const b = this.ball;
    ctx.save();

    // The shadow stays on the turf while the ball rises toward the goal.
    const flight = b.inFlight || b.inNet ? Math.min(1, b.progress || 1) : 0;
    const shadowX = b.inFlight ? b.x : b.inNet ? b.targetX : b.x;
    const goalLineY = 310;
    const shadowY = b.inFlight || b.inNet
      ? b.startY + (goalLineY - b.startY) * flight
      : b.y + b.radius * b.scale * .72;
    const shadowScale = b.inFlight || b.inNet ? .92 * b.scale : .92;
    ctx.globalAlpha = b.inFlight ? .22 - flight * .13 : b.inNet ? .08 : .24;
    ctx.fillStyle = '#02070a';
    ctx.filter = 'blur(5px)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, b.radius * shadowScale, b.radius * .25 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    if (this.football3D) {
      try {
        this.football3D.draw(b);
        ctx.drawImage(this.football3D.canvas, 0, 0, this.vWidth, this.vHeight);
        if (b.inNet && b.netAge < .24) this.renderNetContactOverlay(ctx, b);
        ctx.restore();
        return;
      } catch (error) {
        console.warn('Se perdiÃ³ el contexto 3D del balÃ³n:', error);
        this.football3D = null;
      }
    }

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

    ctx.strokeStyle = 'rgba(22,35,45,.48)';
    ctx.lineWidth = 1.15;
    ctx.shadowColor = 'rgba(225,242,255,.42)';
    ctx.shadowBlur = b.inFlight ? 2.5 : 1.5;
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

}

window.PenaltisGame = PenaltisGame;
