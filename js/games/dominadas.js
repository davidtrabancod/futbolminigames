/**
 * Futbolín Kids Arena - Minijuego 2: "Dominadas Infinitas"
 * Mecánica arcade de mantener el balón en el aire mediante toques táctiles precisos.
 */
class DominadasGame {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;
    this.reset();
  }

  reset() {
    this.vWidth = 400;
    this.vHeight = 600;

    this.score = 0;
    this.combo = 0;
    this.state = 'playing'; // 'playing' | 'game_over'
    
    // Física del balón
    this.ball = {
      x: 200,
      y: 260,
      radius: 32,
      vx: 0,
      vy: -4,
      gravity: 0.28,
      rotation: 0,
      vRot: 0.05
    };

    // Estrellas flotantes de bonus
    this.stars = [];
    this.starTimer = 0;

    // Partículas de impacto al tocar
    this.kickSparks = [];

    // Nubes decorativas en el cielo
    this.clouds = [
      { x: 50, y: 80, speed: 12, scale: 0.8 },
      { x: 280, y: 130, speed: 8, scale: 1.1 }
    ];

    // Texto de feedback efímero
    this.feedbacks = [];
  }

  start() {
    this.reset();
    this.app.updateHUD({
      score: 0,
      streak: 0,
      highScore: window.storageManager.getHighScore('dominadas')
    });
    window.soundManager.playWhistle();
  }

  handlePointerDown(x, y) {
    if (this.state !== 'playing') return;

    // Distancia al centro del balón
    const dx = x - this.ball.x;
    const dy = y - this.ball.y;
    const dist = Math.hypot(dx, dy);

    // Margen de toque generoso para niños (radio del balón + 35px) o toque justo debajo
    if (dist <= this.ball.radius + 35 || (Math.abs(dx) <= 55 && dy >= 0 && dy <= this.ball.radius + 45)) {
      this.kickBall(dx, dy);
    }
  }

  handlePointerMove(x, y) {
    // No requiere arrastre continuo
  }

  handlePointerUp(x, y) {
    // No acción requerida
  }

  kickBall(dx, dy) {
    // Impulso hacia arriba fuerte
    this.ball.vy = -10.5;

    // Fuerza lateral según el punto del toque (control del niño)
    // Tocar a la izquierda empuja a la derecha; tocar a la derecha empuja a la izquierda
    this.ball.vx = -dx * 0.16;

    // Giro angular del balón
    this.ball.vRot = (dx * 0.02) + (Math.random() - 0.5) * 0.1;

    // Aumento de puntuación y racha
    this.score++;
    this.combo++;

    window.soundManager.playBounce();

    // Efecto de chispas en el punto de contacto
    this.spawnKickSparks(this.ball.x, this.ball.y + this.ball.radius * 0.7);

    // Elogios según racha
    if (this.score % 10 === 0) {
      this.addFeedback(`¡${this.score} DOMINADAS! 🔥`, '#facc15');
      window.soundManager.playStar();
    } else if (this.combo === 5) {
      this.addFeedback('¡QUÉ CRACK! 🌟', '#38bdf8');
    }

    this.app.updateHUD({
      score: this.score,
      streak: this.combo,
      highScore: window.storageManager.getHighScore('dominadas')
    });
  }

  spawnKickSparks(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI / 2) + (Math.random() - 0.5) * Math.PI;
      const speed = Math.random() * 5 + 2;
      this.kickSparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 6 + 3,
        alpha: 1.0,
        color: Math.random() > 0.5 ? '#facc15' : '#4ade80'
      });
    }
  }

  addFeedback(text, color) {
    this.feedbacks.push({
      text: text,
      color: color,
      x: 200,
      y: 220,
      vy: -1.2,
      alpha: 1.0,
      scale: 0.9
    });
  }

  update(dt) {
    if (this.state !== 'playing') return;

    const b = this.ball;

    // Aplicar gravedad
    b.vy += b.gravity;
    b.x += b.vx;
    b.y += b.vy;
    b.rotation += b.vRot;

    // Resistencia de aire lateral ligera
    b.vx *= 0.99;

    // Rebote elástico en paredes laterales
    if (b.x - b.radius < 0) {
      b.x = b.radius;
      b.vx = -b.vx * 0.75;
      b.vRot = -b.vRot;
      window.soundManager.playBounce();
    } else if (b.x + b.radius > this.vWidth) {
      b.x = this.vWidth - b.radius;
      b.vx = -b.vx * 0.75;
      b.vRot = -b.vRot;
      window.soundManager.playBounce();
    }

    // Límite superior suave (techo)
    if (b.y - b.radius < 30) {
      b.y = 30 + b.radius;
      b.vy = Math.abs(b.vy) * 0.5;
    }

    // Suelo: ¡Si cae al césped, se acaba la ronda!
    const floorY = this.vHeight - 55;
    if (b.y + b.radius >= floorY) {
      this.gameOver();
      return;
    }

    // Gestión de Estrellas flotantes de bonus
    this.starTimer += dt;
    if (this.starTimer > 4.5) {
      this.starTimer = 0;
      this.spawnStar();
    }

    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.x += s.vx * dt;
      s.y += Math.sin(s.angle) * 0.8;
      s.angle += dt * 3;

      // Colisión balón con estrella
      const dist = Math.hypot(b.x - s.x, b.y - s.y);
      if (dist < b.radius + s.radius) {
        // Estrella recogida!
        this.score += 5;
        this.addFeedback('+5 BONUS! ⭐', '#facc15');
        window.soundManager.playStar();
        window.confettiEngine.burst(s.x, s.y, 25);
        this.stars.splice(i, 1);
        this.app.updateHUD({
          score: this.score,
          streak: this.combo,
          highScore: window.storageManager.getHighScore('dominadas')
        });
        continue;
      }

      // Eliminar si sale de pantalla
      if (s.x < -40 || s.x > this.vWidth + 40) {
        this.stars.splice(i, 1);
      }
    }

    // Actualizar partículas
    for (let i = this.kickSparks.length - 1; i >= 0; i--) {
      const sp = this.kickSparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= dt * 2.5;
      if (sp.alpha <= 0) {
        this.kickSparks.splice(i, 1);
      }
    }

    // Actualizar textos de feedback
    for (let i = this.feedbacks.length - 1; i >= 0; i--) {
      const fb = this.feedbacks[i];
      fb.y += fb.vy;
      fb.alpha -= dt * 0.9;
      fb.scale += dt * 0.3;
      if (fb.alpha <= 0) {
        this.feedbacks.splice(i, 1);
      }
    }

    // Mover nubes
    this.clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x > this.vWidth + 80) c.x = -80;
    });
  }

  spawnStar() {
    const fromLeft = Math.random() > 0.5;
    this.stars.push({
      x: fromLeft ? -30 : this.vWidth + 30,
      y: Math.random() * 200 + 120,
      vx: (fromLeft ? 1 : -1) * (Math.random() * 40 + 30),
      radius: 18,
      angle: 0
    });
  }

  gameOver() {
    this.state = 'game_over';
    window.soundManager.playGameOver();

    const isNew = window.storageManager.setScore('dominadas', this.score);
    this.app.showGameOver({
      score: this.score,
      highScore: window.storageManager.getHighScore('dominadas'),
      isNewRecord: isNew,
      title: this.score >= 20 ? '¡Dominio Legendario! 🌟' : '¡Buen Intento! ⚽',
      subtitle: `Lograste mantener el balón durante ${this.score} toques seguidos`
    });
  }

  render(ctx) {
    // Fondo de cielo y césped
    this.renderEnvironment(ctx);

    // Estrellas de bonus
    this.renderStars(ctx);

    // Chispas de toque
    this.renderSparks(ctx);

    // Balón
    this.renderBall(ctx);

    // Textos de feedback flotantes
    this.renderFeedbacks(ctx);
  }

  renderEnvironment(ctx) {
    // Cielo soleado vibrante
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.vHeight - 80);
    skyGrad.addColorStop(0, '#38bdf8');
    skyGrad.addColorStop(0.7, '#bae6fd');
    skyGrad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.vWidth, this.vHeight);

    // Sol sonriente en la esquina superior derecha
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(350, 60, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(350, 60, 44, 0, Math.PI * 2);
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Nubes esponjosas
    this.clouds.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.arc(22, -6, 25, 0, Math.PI * 2);
      ctx.arc(44, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Franja de césped inferior (zona prohibida donde no debe tocar el balón)
    const grassGrad = ctx.createLinearGradient(0, this.vHeight - 70, 0, this.vHeight);
    grassGrad.addColorStop(0, '#22c55e');
    grassGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, this.vHeight - 65, this.vWidth, 65);

    // Flores y briznas de césped animadas
    ctx.fillStyle = '#166534';
    for (let x = 10; x < this.vWidth; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, this.vHeight - 65);
      ctx.lineTo(x + 5, this.vHeight - 80);
      ctx.lineTo(x + 10, this.vHeight - 65);
      ctx.fill();
    }
  }

  renderStars(ctx) {
    this.stars.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      
      // Resplandor
      ctx.fillStyle = 'rgba(250, 204, 21, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Estrella dorada
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const innerAngle = outerAngle + Math.PI / 5;
        const ox = Math.cos(outerAngle) * s.radius;
        const oy = Math.sin(outerAngle) * s.radius;
        const ix = Math.cos(innerAngle) * (s.radius * 0.45);
        const iy = Math.sin(innerAngle) * (s.radius * 0.45);
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });
  }

  renderSparks(ctx) {
    this.kickSparks.forEach(sp => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.alpha);
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  renderBall(ctx) {
    const b = this.ball;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);

    // Sombra del balón proyectada en el césped según altura
    const distToGround = (this.vHeight - 65) - b.y;
    const shadowScale = Math.max(0.2, 1.0 - distToGround / 500);

    // Balón base blanco
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pentágono central
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(angle) * (b.radius * 0.45);
      const py = Math.sin(angle) * (b.radius * 0.45);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Costuras a pentágonos exteriores
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px1 = Math.cos(angle) * (b.radius * 0.45);
      const py1 = Math.sin(angle) * (b.radius * 0.45);
      const px2 = Math.cos(angle) * (b.radius * 0.95);
      const py2 = Math.sin(angle) * (b.radius * 0.95);

      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
    }

    // Brillo 3D
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(-b.radius * 0.35, -b.radius * 0.35, b.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

window.DominadasGame = DominadasGame;
