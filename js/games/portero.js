/**
 * Futbolín Kids Arena - Minijuego 3: "Super Portero"
 * Mecánica defensiva en primera persona donde el niño controla los guantes para atajar disparos.
 */
class PorteroGame {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;
    this.reset();
  }

  reset() {
    this.vWidth = 400;
    this.vHeight = 600;

    this.score = 0;
    this.saves = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.state = 'playing'; // 'playing' | 'game_over'

    // Posición de los guantes (siguen el toque con suavidad)
    this.gloves = {
      x: 200,
      y: 350,
      targetX: 200,
      targetY: 350,
      radius: 46,
      scale: 1.0,
      punchAnim: 0
    };

    // Colección de balones que vuelan hacia la portería
    this.balls = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.2; // Segundos entre disparos

    // Partículas de impacto
    this.impactParticles = [];

    // Mensajes flotantes ("¡PARADÓN!")
    this.feedbacks = [];

    // Sacudida de pantalla si marcan gol
    this.shake = 0;
  }

  start() {
    this.reset();
    this.app.updateHUD({
      score: 0,
      lives: this.lives,
      highScore: window.storageManager.getHighScore('portero')
    });
    window.soundManager.playWhistle();
  }

  handlePointerDown(x, y) {
    if (this.state !== 'playing') return;
    this.gloves.targetX = x;
    this.gloves.targetY = y;
  }

  handlePointerMove(x, y) {
    if (this.state !== 'playing') return;
    this.gloves.targetX = x;
    this.gloves.targetY = y;
  }

  handlePointerUp(x, y) {
    // Mantener guantes donde se soltó
  }

  update(dt) {
    if (this.state !== 'playing') return;

    // Suavizado del movimiento de los guantes (Lerp)
    this.gloves.x += (this.gloves.targetX - this.gloves.x) * 14 * dt;
    this.gloves.y += (this.gloves.targetY - this.gloves.y) * 14 * dt;

    // Límite de movimiento de los guantes dentro de la portería
    this.gloves.x = Math.max(50, Math.min(350, this.gloves.x));
    this.gloves.y = Math.max(90, Math.min(480, this.gloves.y));

    // Animación de impacto del guante
    if (this.gloves.punchAnim > 0) {
      this.gloves.punchAnim -= dt * 4;
    }

    // Temporizador de generación de disparos
    this.spawnTimer += dt;
    // Dificultad progresiva: mayor puntuación = disparos más frecuentes
    const currentInterval = Math.max(1.1, this.spawnInterval - (this.saves * 0.05));
    if (this.spawnTimer >= currentInterval) {
      this.spawnTimer = 0;
      this.spawnShot();
    }

    // Actualizar balones en vuelo
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.progress += dt / b.flightTime;

      const t = Math.min(1.0, b.progress);

      // Interpolación de escala (crece al acercarse a la pantalla)
      b.scale = b.startScale + (b.targetScale - b.startScale) * t;

      // Movimiento con posible efecto curvo
      const currentX = b.startX + (b.targetX - b.startX) * t + Math.sin(t * Math.PI) * b.curve;
      const currentY = b.startY + (b.targetY - b.startY) * t;
      b.x = currentX;
      b.y = currentY;
      b.rotation += dt * 10;

      // Detección de parada cuando el balón está cerca del plano de parada (t entre 0.78 y 1.0)
      if (t >= 0.78 && !b.saved && !b.scored) {
        const ballR = b.baseRadius * b.scale;
        const distCenter = Math.hypot(b.x - this.gloves.x, b.y - this.gloves.y);
        const distLeft = Math.hypot(b.x - (this.gloves.x - 26), b.y - this.gloves.y);
        const distRight = Math.hypot(b.x - (this.gloves.x + 26), b.y - this.gloves.y);
        
        // Atajado si cualquiera de los guantes o el centro bloquea el balón
        if (distCenter <= this.gloves.radius + ballR ||
            distLeft <= 36 + ballR ||
            distRight <= 36 + ballR) {
          this.blockBall(b);
          this.balls.splice(i, 1);
          continue;
        }
      }

      // Si el balón cruza la línea sin ser atajado (¡GOL EN CONTRA!)
      if (t >= 1.0 && !b.saved && !b.scored) {
        b.scored = true;
        this.concedeGoal(b);
        this.balls.splice(i, 1);
        continue;
      }
    }

    // Actualizar partículas
    for (let i = this.impactParticles.length - 1; i >= 0; i--) {
      const p = this.impactParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= dt * 2.2;
      if (p.alpha <= 0) {
        this.impactParticles.splice(i, 1);
      }
    }

    // Actualizar feedbacks
    for (let i = this.feedbacks.length - 1; i >= 0; i--) {
      const fb = this.feedbacks[i];
      fb.y += fb.vy;
      fb.alpha -= dt * 1.1;
      fb.scale += dt * 0.4;
      if (fb.alpha <= 0) {
        this.feedbacks.splice(i, 1);
      }
    }

    // Sacudida de pantalla
    if (this.shake > 0) {
      this.shake -= dt * 30;
    }
  }

  spawnShot() {
    // Tipo de disparo: normal (70%), fuego/rápido (20%), efecto banana (10%)
    const rand = Math.random();
    let type = 'normal';
    let flightTime = Math.max(0.9, 1.6 - this.saves * 0.03);
    let curve = 0;

    if (rand > 0.8) {
      type = 'curve';
      curve = (Math.random() - 0.5) * 110;
    } else if (rand > 0.6) {
      type = 'fire';
      flightTime *= 0.75;
    }

    // Origen: punto lejano en el campo
    const startX = 200 + (Math.random() - 0.5) * 80;
    const startY = 175;

    // Destino: hacia las esquinas o centro de la portería
    const targetX = Math.random() * 260 + 70;
    const targetY = Math.random() * 280 + 130;

    this.balls.push({
      startX,
      startY,
      targetX,
      targetY,
      x: startX,
      y: startY,
      baseRadius: 28,
      startScale: 0.18,
      targetScale: 1.0,
      scale: 0.18,
      progress: 0,
      flightTime,
      curve,
      rotation: 0,
      type,
      saved: false,
      scored: false
    });
  }

  blockBall(ball) {
    this.saves++;
    this.score += ball.type === 'fire' ? 25 : 10;
    this.gloves.punchAnim = 1.0;

    window.soundManager.playCatch();

    // Explosión de estrellas
    this.spawnImpactStars(ball.x, ball.y);

    const praises = ['¡PARADÓN! 🧤', '¡MANOPLA DE ORO! 🏆', '¡QUÉ REFLEJOS! ⚡', '¡BLOQUEO PERFECTO! 🛡️'];
    const text = praises[Math.floor(Math.random() * praises.length)];
    this.addFeedback(text, '#38bdf8', ball.x, ball.y);

    this.app.updateHUD({
      score: this.score,
      lives: this.lives,
      highScore: window.storageManager.getHighScore('portero')
    });
  }

  concedeGoal(ball) {
    this.lives--;
    this.shake = 12;
    window.soundManager.playGameOver();

    this.addFeedback('¡GOL DEL RIVAL! ⚽💔', '#ef4444', 200, 240);

    this.app.updateHUD({
      score: this.score,
      lives: this.lives,
      highScore: window.storageManager.getHighScore('portero')
    });

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  spawnImpactStars(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      this.impactParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        size: Math.random() * 6 + 3,
        color: Math.random() > 0.5 ? '#facc15' : '#38bdf8'
      });
    }
  }

  addFeedback(text, color, x, y) {
    this.feedbacks.push({
      text,
      color,
      x: x || 200,
      y: y || 240,
      vy: -1.0,
      alpha: 1.0,
      scale: 0.8
    });
  }

  gameOver() {
    this.state = 'game_over';
    const isNew = window.storageManager.setScore('portero', this.score);
    this.app.showGameOver({
      score: this.score,
      highScore: window.storageManager.getHighScore('portero'),
      isNewRecord: isNew,
      title: this.saves >= 15 ? '¡Guante de Oro Absoluto! 🧤' : '¡Fin del Partido! ⚽',
      subtitle: `Lograste atajar ${this.saves} disparos a portería`
    });
  }

  render(ctx) {
    ctx.save();

    // Sacudida de cámara
    if (this.shake > 0) {
      const sx = (Math.random() - 0.5) * this.shake;
      const sy = (Math.random() - 0.5) * this.shake;
      ctx.translate(sx, sy);
    }

    // Fondo del estadio en perspectiva
    this.renderStadiumView(ctx);

    // Balones volando hacia la cámara
    this.renderIncomingBalls(ctx);

    // Marco de la portería en primer plano
    this.renderGoalFrame(ctx);

    // Guantes de portero del jugador
    this.renderGloves(ctx);

    // Partículas de impacto
    this.renderParticles(ctx);

    // Textos de elogio flotantes
    this.renderFeedbacks(ctx);

    ctx.restore();
  }

  renderStadiumView(ctx) {
    // Cielo de atardecer / luces de estadio
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 190);
    skyGrad.addColorStop(0, '#1e1b4b');
    skyGrad.addColorStop(1, '#312e81');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.vWidth, 190);

    // Focos del estadio brillantes
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(60, 40, 14, 0, Math.PI * 2);
    ctx.arc(340, 40, 14, 0, Math.PI * 2);
    ctx.fill();

    // Campo de fútbol verde alejándose en perspectiva
    const pitchGrad = ctx.createLinearGradient(0, 170, 0, this.vHeight);
    pitchGrad.addColorStop(0, '#15803d');
    pitchGrad.addColorStop(1, '#166534');
    ctx.fillStyle = pitchGrad;
    ctx.fillRect(0, 170, this.vWidth, this.vHeight - 170);

    // Líneas del campo en perspectiva
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;

    // Línea central y semicírculo
    ctx.beginPath();
    ctx.moveTo(120, 175);
    ctx.lineTo(280, 175);
    ctx.stroke();

    // Siluetas de jugadores rivales en el centro del campo
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(200, 168, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(197, 174, 6, 8);
  }

  renderIncomingBalls(ctx) {
    this.balls.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.scale, b.scale);
      ctx.rotate(b.rotation);

      // Estela de fuego si es tiro especial
      if (b.type === 'fire') {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, b.baseRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Balón base
      ctx.fillStyle = b.type === 'fire' ? '#fed7aa' : '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, b.baseRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Pentágono interior
      ctx.fillStyle = b.type === 'fire' ? '#ea580c' : '#0f172a';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5;
        const px = Math.cos(a) * (b.baseRadius * 0.45);
        const py = Math.sin(a) * (b.baseRadius * 0.45);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });
  }

  renderGoalFrame(ctx) {
    // Red tenue visible en los bordes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < this.vWidth; x += 18) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.vHeight);
    }
    for (let y = 0; y < this.vHeight; y += 18) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.vWidth, y);
    }
    ctx.stroke();

    // Marco blanco grueso de la portería en primer plano
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'square';
    ctx.beginPath();
    // Poste izquierdo
    ctx.moveTo(14, this.vHeight);
    ctx.lineTo(14, 14);
    // Travesaño
    ctx.lineTo(this.vWidth - 14, 14);
    // Poste derecho
    ctx.lineTo(this.vWidth - 14, this.vHeight);
    ctx.stroke();

    // Resalte metálico
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  renderGloves(ctx) {
    const g = this.gloves;
    const punchScale = 1.0 + (g.punchAnim * 0.25);

    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(punchScale, punchScale);

    // Par de Guantes de Portero
    this.drawSingleGlove(ctx, -26, 0, false);
    this.drawSingleGlove(ctx, 26, 0, true);

    ctx.restore();
  }

  drawSingleGlove(ctx, x, y, isRight) {
    ctx.save();
    ctx.translate(x, y);
    if (isRight) ctx.scale(-1, 1);

    // Sombra del guante
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 8, 24, 0, Math.PI * 2);
    ctx.fill();

    // Palma y base del guante (Azul turquesa y amarillo vivo)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(-22, -26, 44, 48, 14);
    ctx.fill();

    // Zona acolchada frontal (Látex amarillo para agarrar el balón)
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(-18, -22, 36, 38, 10);
    ctx.fill();

    // Muñequera con velcro
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-18, 18, 36, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, 22, 16, 4);

    // Pulgar
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(-22, -6, 10, 8, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(-20, -6, 7, 5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderParticles(ctx) {
    this.impactParticles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  renderFeedbacks(ctx) {
    this.feedbacks.forEach(fb => {
      ctx.save();
      ctx.translate(fb.x, fb.y);
      ctx.scale(fb.scale, fb.scale);
      ctx.globalAlpha = Math.max(0, fb.alpha);
      ctx.fillStyle = fb.color;
      ctx.font = '800 24px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 5;
      ctx.strokeText(fb.text, 0, 0);
      ctx.fillText(fb.text, 0, 0);
      ctx.restore();
    });
  }
}

window.PorteroGame = PorteroGame;
