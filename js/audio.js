/**
 * Futbolín Kids Arena - Efectos de sonido Web Audio API y música externa por destino.
 */
const COUNTRY_MUSIC_TRACKS = {
  tokyo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Koto_performance.ogg',
    title: 'Koto performance',
    artist: 'Torsodog',
    license: 'CC BY 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Koto_performance.ogg',
    loopStart: 2.5,
    loopEnd: 14.5
  },
  rio: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Audionautix-com-ccby-sidewayssamba.mp3',
    title: 'Sideways Samba',
    artist: 'Jason Shaw (Audionautix)',
    license: 'CC BY 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-sidewayssamba.mp3',
    loopStart: 73,
    loopEnd: 89
  },
  munich: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Super_Polka_%28ISRC_USUAN1100056%29.mp3',
    title: 'Super Polka',
    artist: 'Kevin MacLeod',
    license: 'CC BY 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Super_Polka_(ISRC_USUAN1100056).mp3',
    loopStart: 30.5,
    loopEnd: 42.5
  },
  milan: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Tarantella.ogg',
    title: 'Tarantella napoletana',
    artist: 'United States Air Force Band, Air Force Strings',
    license: 'Dominio público',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tarantella.ogg',
    loopStart: 49,
    loopEnd: 61
  },
  madrid: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Flamenco_sample_by_FRANCISCOKEEP.ogg',
    title: 'Flamenco',
    artist: 'FranciscoKeep DJ Producciones',
    license: 'CC BY 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Flamenco_sample_by_FRANCISCOKEEP.ogg',
    loopStart: 52.5,
    loopEnd: 68.5
  }
};

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('fka_muted') === 'true';
    this.countryMusicAudio = null;
    this.countryMusicCountry = null;
    this.countryMusicPaused = false;
    this.countryMusicReady = false;
  }

  // Inicializa o reanuda el AudioContext con la primera interacción del usuario
  initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('fka_muted', this.muted);
    this.updateCountryMusicVolume();
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  getCountryMusicTrack(countryId) {
    return COUNTRY_MUSIC_TRACKS[countryId] || null;
  }

  startCountryMusic(countryId) {
    const track = COUNTRY_MUSIC_TRACKS[countryId];
    if (!track) {
      throw new Error(`No hay música ambiental configurada para el destino "${countryId}".`);
    }
    if (this.countryMusicCountry === countryId && this.countryMusicAudio) {
      if (this.countryMusicAudio.paused && !this.countryMusicPaused) {
        this.playCountryTrack();
      }
      return;
    }

    this.stopCountryMusic();
    const audio = new Audio();
    audio.preload = 'none';
    audio.loop = false;
    audio.volume = this.muted ? 0 : 0.3;
    audio.addEventListener('loadedmetadata', () => {
      if (this.countryMusicAudio !== audio) return;
      audio.currentTime = track.loopStart;
    });
    audio.addEventListener('seeked', () => {
      if (this.countryMusicAudio !== audio) return;
      if (!this.countryMusicReady) {
        this.countryMusicReady = true;
        this.playCountryTrack();
      }
    });
    audio.addEventListener('timeupdate', () => {
      if (this.countryMusicAudio === audio && audio.currentTime >= track.loopEnd) {
        audio.currentTime = track.loopStart;
      }
    });
    audio.addEventListener('error', () => {
      if (this.countryMusicAudio !== audio) return;
      window.dispatchEvent(new CustomEvent('country-music-error', { detail: { countryId } }));
    });
    audio.src = track.url;
    this.countryMusicAudio = audio;
    this.countryMusicCountry = countryId;
    this.countryMusicPaused = false;
    this.countryMusicReady = false;
    audio.load();
  }

  updateCountryMusicVolume() {
    if (!this.countryMusicAudio) return;
    this.countryMusicAudio.volume = 0.3;
    if (this.muted || this.countryMusicPaused) {
      this.countryMusicAudio.pause();
    } else {
      this.playCountryTrack();
    }
  }

  pauseCountryMusic(paused) {
    this.countryMusicPaused = paused;
    if (paused) {
      this.countryMusicAudio?.pause();
    } else {
      this.playCountryTrack();
    }
  }

  playCountryTrack() {
    if (!this.countryMusicAudio || !this.countryMusicReady || this.muted || this.countryMusicPaused) return;
    this.countryMusicAudio.play().catch(() => {
      window.dispatchEvent(new CustomEvent('country-music-error', {
        detail: { countryId: this.countryMusicCountry }
      }));
    });
  }

  stopCountryMusic() {
    if (this.countryMusicAudio) {
      this.countryMusicAudio.pause();
      this.countryMusicAudio.removeAttribute('src');
      this.countryMusicAudio.load();
    }
    this.countryMusicAudio = null;
    this.countryMusicCountry = null;
    this.countryMusicPaused = false;
    this.countryMusicReady = false;
  }

  // Sonido de patada contundente al balón
  playKick() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.12);

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Sonido de rebote / dominada suave
  playBounce() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Sonido de parada con guantes (Super Portero)
  playCatch() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // Ruido filtrado de impacto de guante
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
  }

  // Sonido de choque con el poste / travesaño
  playPost() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.25);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Sonido de Silbato de Árbitro
  playWhistle() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(2600, t);
    osc2.frequency.setValueAtTime(2850, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.setValueAtTime(0.3, t + 0.25);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.42);
    osc2.stop(t + 0.42);
  }

  // Fanfarria alegre de ¡¡GOLAZO!!
  playGoal() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
    const now = this.ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);

      gain.gain.setValueAtTime(0.4, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.36);
    });
  }

  // Sonido de estrella o bonus
  playStar() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.setValueAtTime(880.00, t + 0.07); // A5

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Sonido simpático de Fin de Juego
  playGameOver() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [392.00, 349.23, 311.13, 261.63]; // G4, F4, D#4, C4
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);

      gain.gain.setValueAtTime(0.2, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.16 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.26);
    });
  }

  // Clic de botón
  playClick() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Rugido masivo de la afición en el estadio (¡¡GOOOOL!!)
  playCrowdCheer() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 2.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Ruido blanco con modulación que simula miles de voces rugiendo
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Filtro pasabanda resonante para dar textura vocal a la grada
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, t);
    filter.Q.setValueAtTime(1.8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.75, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 2.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
  }

  // Lamento colectivo de la grada (¡¡UYYYY!!) cuando falla o pega en el palo
  playCrowdGroan() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 1.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.linearRampToValueAtTime(220, t + 1.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
  }

  // Sonido del balón inflando la red de nylon
  playNetSwish() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.28;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
  }

  // Sonido de super-tiro anime estilo Oliver y Benji ("¡Tiro con Efecto!")
  playAnimeShot() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Oscilador de barrido de frecuencia láser/energía
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.35);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Estallido sónico manga al romper la red o golpear el poste
  playAnimeImpact() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.3);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.36);
  }
}

window.soundManager = new SoundManager();
