/**
 * Futbolín Kids Arena - Motor de Confeti y Partículas de Celebración
 * Renders celebratorios a 60 FPS con rotación 3D y colores vibrantes.
 */
class ConfettiEngine {
  constructor() {
    this.particles = [];
    this.colors = ['#facc15', '#22c55e', '#38bdf8', '#f43f5e', '#a855f7', '#fb923c', '#ffffff'];
  }

  // Genera una explosión festiva de confeti
  burst(x, y, count = 70) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // Impulso ascendente
        gravity: 0.18,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        size: Math.random() * 8 + 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        life: 1.0,
        decay: Math.random() * 0.015 + 0.01,
        shape: Math.random() > 0.4 ? 'rect' : 'circle'
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98; // Resistencia de aire
      p.rotation += p.rotationSpeed;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    if (this.particles.length === 0) return;

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  clear() {
    this.particles = [];
  }
}

window.confettiEngine = new ConfettiEngine();

