class OnlineArena {
  constructor(app) {
    this.app = app;
    this.user = null;
    this.socket = null;
    this.socketPromise = null;
    this.authMode = 'login';
    this.selectedAvatar = '⚽';
    this.playerIndex = 0;
    this.currentMode = 'ranked';
    this.currentRole = null;
    this.actionSubmitted = false;
    this.matchActive = false;
    this.lastQueueMode = 'ranked';
    this.refs = {
      profileButton: document.getElementById('profileButton'),
      profileAvatar: document.getElementById('profileAvatar'),
      profileNickname: document.getElementById('profileNickname'),
      profileModal: document.getElementById('profileModal'),
      profileTitle: document.getElementById('profileDialogTitle'),
      profileForm: document.getElementById('profileForm'),
      authModeTabs: document.getElementById('authModeTabs'),
      authModeLogin: document.getElementById('authModeLogin'),
      authModeRegister: document.getElementById('authModeRegister'),
      authNickname: document.getElementById('authNickname'),
      authPassword: document.getElementById('authPassword'),
      passwordHint: document.getElementById('passwordHint'),
      avatarPicker: document.getElementById('avatarPicker'),
      avatarChoices: document.getElementById('avatarChoices'),
      profileFormStatus: document.getElementById('profileFormStatus'),
      profileSubmitBtn: document.getElementById('profileSubmitBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      onlineStatus: document.getElementById('onlineStatus'),
      rankedMatchBtn: document.getElementById('rankedMatchBtn'),
      createFriendlyBtn: document.getElementById('createFriendlyBtn'),
      joinInviteForm: document.getElementById('joinInviteForm'),
      inviteCodeInput: document.getElementById('inviteCodeInput'),
      invitePanel: document.getElementById('invitePanel'),
      inviteCode: document.getElementById('inviteCode'),
      copyInviteBtn: document.getElementById('copyInviteBtn'),
      cancelOnlineBtn: document.getElementById('cancelOnlineBtn'),
      backToWorldTourBtn: document.getElementById('backToWorldTourBtn'),
      leaderboardList: document.getElementById('leaderboardList'),
      onlineMatchScreen: document.getElementById('onlineMatchScreen'),
      onlineMatchMode: document.getElementById('onlineMatchMode'),
      onlineYouAvatar: document.getElementById('onlineYouAvatar'),
      onlineYouName: document.getElementById('onlineYouName'),
      onlineYouMeta: document.getElementById('onlineYouMeta'),
      onlineYouScore: document.getElementById('onlineYouScore'),
      onlineYouShots: document.getElementById('onlineYouShots'),
      onlineOpponentAvatar: document.getElementById('onlineOpponentAvatar'),
      onlineOpponentName: document.getElementById('onlineOpponentName'),
      onlineOpponentMeta: document.getElementById('onlineOpponentMeta'),
      onlineOpponentScore: document.getElementById('onlineOpponentScore'),
      onlineOpponentShots: document.getElementById('onlineOpponentShots'),
      onlineRoundLabel: document.getElementById('onlineRoundLabel'),
      suddenDeathBadge: document.getElementById('suddenDeathBadge'),
      onlineTurnStatus: document.getElementById('onlineTurnStatus'),
      onlineZonePicker: document.getElementById('onlineZonePicker'),
      onlineActionProgress: document.getElementById('onlineActionProgress'),
      onlineShotResult: document.getElementById('onlineShotResult'),
      forfeitOnlineBtn: document.getElementById('forfeitOnlineBtn'),
      onlineMatchResult: document.getElementById('onlineMatchResult'),
      onlineResultIcon: document.getElementById('onlineResultIcon'),
      onlineResultTitle: document.getElementById('onlineResultTitle'),
      onlineResultSummary: document.getElementById('onlineResultSummary'),
      onlineRatingChange: document.getElementById('onlineRatingChange')
    };

    this.bindEvents();
    this.loadCurrentUser();
    this.loadLeaderboard();
  }

  bindEvents() {
    this.refs.profileButton.addEventListener('click', () => this.openProfile());
    document.getElementById('closeProfileBtn').addEventListener('click', () => this.closeProfile());
    this.refs.profileModal.addEventListener('click', event => {
      if (event.target === this.refs.profileModal) this.closeProfile();
    });
    this.refs.authModeLogin.addEventListener('click', () => this.setAuthMode('login'));
    this.refs.authModeRegister.addEventListener('click', () => this.setAuthMode('register'));
    this.refs.avatarChoices.addEventListener('click', event => {
      const choice = event.target.closest('[data-avatar]');
      if (!choice) return;
      this.selectedAvatar = choice.dataset.avatar;
      this.updateAvatarSelection();
    });
    this.refs.profileForm.addEventListener('submit', event => {
      event.preventDefault();
      this.submitProfileForm();
    });
    this.refs.logoutBtn.addEventListener('click', () => this.logout());

    document.getElementById('rankedMatchBtn').addEventListener('click', () => this.startRankedQueue());
    document.getElementById('createFriendlyBtn').addEventListener('click', () => this.createFriendlyMatch());
    this.refs.joinInviteForm.addEventListener('submit', event => {
      event.preventDefault();
      this.joinFriendlyMatch();
    });
    this.refs.copyInviteBtn.addEventListener('click', () => this.copyInviteCode());
    this.refs.cancelOnlineBtn.addEventListener('click', () => this.cancelQueue());
    this.refs.backToWorldTourBtn.addEventListener('click', () => {
      document.getElementById('worldTourLevels').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('refreshLeaderboardBtn').addEventListener('click', () => this.loadLeaderboard());

    this.refs.forfeitOnlineBtn.addEventListener('click', () => {
      if (!this.matchActive || !window.confirm('¿Seguro que quieres abandonar la partida? Se contará como derrota.')) return;
      this.send({ type: 'forfeit' });
      this.refs.forfeitOnlineBtn.disabled = true;
    });
    document.getElementById('onlinePlayAgainBtn').addEventListener('click', () => {
      this.refs.onlineMatchResult.classList.add('hidden');
      if (this.currentMode === 'friendly') this.createFriendlyMatch();
      else this.startRankedQueue();
    });
    document.getElementById('onlineReturnBtn').addEventListener('click', () => {
      this.matchActive = false;
      this.app.goToMenu();
    });
  }

  async api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Solicitud fallida (${response.status}).`);
    return payload;
  }

  async loadCurrentUser() {
    try {
      const { user } = await this.api('/api/me');
      this.setUser(user);
    } catch (error) {}
  }

  async loadLeaderboard() {
    try {
      const { entries } = await this.api('/api/leaderboard');
      this.refs.leaderboardList.replaceChildren();
      if (!entries.length) {
        this.refs.leaderboardList.append(this.makeLeaderboardMessage('¡Sé el primero en jugar!'));
      } else {
        entries.forEach(entry => this.refs.leaderboardList.append(this.makeLeaderboardRow(entry)));
      }
      if (this.user) this.updateRankBadge(this.user);
    } catch {}
  }

  makeLeaderboardMessage(text) {
    const row = document.createElement('li');
    row.className = 'leaderboard__empty';
    row.textContent = text;
    return row;
  }

  makeLeaderboardRow(entry) {
    const row = document.createElement('li');
    row.className = 'leaderboard__row';
    const position = document.createElement('span');
    position.className = 'leaderboard__position';
    position.textContent = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`;
    const identity = document.createElement('span');
    identity.className = 'leaderboard__identity';
    const avatar = document.createElement('span');
    avatar.textContent = entry.avatar;
    const nickname = document.createElement('span');
    nickname.textContent = entry.nickname;
    identity.append(avatar, nickname);
    const rating = document.createElement('span');
    rating.className = 'leaderboard__rating';
    rating.textContent = `${entry.rating} pts`;
    row.append(position, identity, rating);
    return row;
  }

  setUser(user) {
    this.user = user || null;
    if (this.user) {
      this.refs.profileAvatar.textContent = this.user.avatar;
      this.refs.profileNickname.textContent = this.user.nickname;
      this.updateRankBadge(this.user);
    } else {
      this.refs.profileAvatar.textContent = '👤';
      this.refs.profileNickname.textContent = 'Entrar';
    }
  }

  updateRankBadge(user) {
    const rankValue = document.querySelector('.game-card__rank .game-card__stat-value');
    const rankStatus = document.querySelector('.game-card__rank-status');
    if (rankValue) rankValue.textContent = `#${user.rank}`;
    if (rankStatus) rankStatus.textContent = `${user.rating} puntos`;
  }

  openProfile() {
    this.refs.profileForm.reset();
    this.refs.profileModal.classList.remove('hidden');
    this.refs.profileModal.classList.add('flex');
    if (this.user) {
      this.authMode = 'profile';
      this.refs.profileTitle.textContent = 'Tu perfil de jugador';
      this.refs.authModeTabs.classList.add('hidden');
      this.refs.authNickname.value = this.user.nickname;
      this.selectedAvatar = this.user.avatar;
      this.refs.authPassword.parentElement.classList.add('hidden');
      this.refs.authPassword.required = false;
      this.refs.passwordHint.classList.add('hidden');
      this.refs.avatarPicker.classList.remove('hidden');
      this.refs.profileSubmitBtn.textContent = 'Guardar perfil';
      this.refs.logoutBtn.classList.remove('hidden');
    } else {
      this.refs.authModeTabs.classList.remove('hidden');
      this.refs.logoutBtn.classList.add('hidden');
      this.refs.authPassword.parentElement.classList.remove('hidden');
      this.refs.authPassword.required = true;
      this.setAuthMode('login');
    }
  }

  closeProfile() {
    this.refs.profileModal.classList.add('hidden');
    this.refs.profileModal.classList.remove('flex');
  }

  setAuthMode(mode) {
    if (this.user) return;
    this.authMode = mode;
    const registering = mode === 'register';
    this.refs.authModeLogin.classList.toggle('is-active', !registering);
    this.refs.authModeRegister.classList.toggle('is-active', registering);
    this.refs.profileTitle.textContent = registering ? 'Crea tu cuenta' : 'Entra en la competición';
    this.refs.passwordHint.classList.toggle('hidden', !registering);
    this.refs.avatarPicker.classList.toggle('hidden', !registering);
    this.refs.profileSubmitBtn.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
    this.refs.authPassword.required = true;
  }

  updateAvatarSelection() {
    this.refs.avatarChoices.querySelectorAll('[data-avatar]').forEach(button => {
      button.classList.toggle('is-selected', button.dataset.avatar === this.selectedAvatar);
    });
  }

  async submitProfileForm() {
    try {
      const nickname = this.refs.authNickname.value.trim();
      let payload;
      if (this.authMode === 'profile') {
        payload = await this.api('/api/profile', { method: 'PUT', body: JSON.stringify({ nickname, avatar: this.selectedAvatar }) });
      } else {
        const body = { nickname, password: this.refs.authPassword.value };
        if (this.authMode === 'register') body.avatar = this.selectedAvatar;
        payload = await this.api(`/api/${this.authMode}`, { method: 'POST', body: JSON.stringify(body) });
      }
      this.setUser(payload.user);
      this.closeProfile();
      await this.loadLeaderboard();
    } catch (error) {
      this.refs.profileFormStatus.textContent = error.message;
      this.refs.profileFormStatus.classList.add('is-error');
    }
  }

  async logout() {
    try {
      await this.api('/api/logout', { method: 'POST', body: '{}' });
      this.user = null;
      this.closeProfile();
      if (this.socket) { this.socket.close(); this.socket = null; }
      this.setUser(null);
    } catch {}
  }

  async ensureSocket() {
    if (!this.user) {
      this.openProfile();
      throw new Error('Inicia sesión para jugar online.');
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return this.socket;
    if (this.socketPromise) return this.socketPromise;

    this.socketPromise = new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      this.socket = socket;
      let settled = false;
      socket.addEventListener('open', () => { if (!settled) { settled = true; resolve(socket); } }, { once: true });
      socket.addEventListener('message', event => this.handleSocketMessage(event));
      socket.addEventListener('error', () => { if (!settled) { settled = true; reject(new Error('Error de conexión.')); } });
      socket.addEventListener('close', () => { this.socket = null; this.socketPromise = null; });
    }).finally(() => { this.socketPromise = null; });
    return this.socketPromise;
  }

  send(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  async startRankedQueue() {
    this.refs.cancelOnlineBtn.classList.remove('hidden');
    this.refs.rankedMatchBtn.disabled = true;
    this.refs.createFriendlyBtn.disabled = true;
    try {
      await this.ensureSocket();
      this.send({ type: 'queue-ranked' });
    } catch (error) {
      this.refs.cancelOnlineBtn.classList.add('hidden');
      this.refs.rankedMatchBtn.disabled = false;
      this.refs.createFriendlyBtn.disabled = false;
    }
  }

  async createFriendlyMatch() {
    this.refs.cancelOnlineBtn.classList.remove('hidden');
    this.refs.rankedMatchBtn.disabled = true;
    this.refs.createFriendlyBtn.disabled = true;
    try {
      await this.ensureSocket();
      this.send({ type: 'create-invite' });
    } catch (error) {
      this.refs.cancelOnlineBtn.classList.add('hidden');
      this.refs.rankedMatchBtn.disabled = false;
      this.refs.createFriendlyBtn.disabled = false;
    }
  }

  async joinFriendlyMatch() {
    const code = this.refs.inviteCodeInput.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return;
    this.refs.cancelOnlineBtn.classList.remove('hidden');
    this.refs.rankedMatchBtn.disabled = true;
    this.refs.createFriendlyBtn.disabled = true;
    try {
      await this.ensureSocket();
      this.send({ type: 'join-invite', code });
    } catch (error) {
      this.refs.cancelOnlineBtn.classList.add('hidden');
      this.refs.rankedMatchBtn.disabled = false;
      this.refs.createFriendlyBtn.disabled = false;
    }
  }

  cancelQueue() {
    this.send({ type: 'cancel' });
  }

  async copyInviteCode() {
    try { await navigator.clipboard.writeText(this.refs.inviteCode.textContent); } catch {}
  }

  handleSocketMessage(event) {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    switch (message.type) {
      case 'connected':
        if (message.user) this.setUser(message.user);
        break;
      case 'invite-created':
        this.refs.inviteCode.textContent = message.code;
        this.refs.invitePanel.classList.remove('hidden');
        break;
      case 'cancelled':
        this.refs.cancelOnlineBtn.classList.add('hidden');
        this.refs.rankedMatchBtn.disabled = false;
        this.refs.createFriendlyBtn.disabled = false;
        this.refs.invitePanel.classList.add('hidden');
        break;
      case 'match-start':
        this.beginMatch(message);
        break;
      case 'turn':
        this.showTurn(message);
        break;
      case 'action-progress':
        this.showActionProgress(message);
        break;
      case 'shot-result':
        this.showShotResult(message);
        break;
      case 'match-end':
        this.showOnlineResult(message);
        break;
    }
  }

  beginMatch(message) {
    this.currentMode = message.mode;
    this.playerIndex = message.playerIndex;
    this.matchActive = true;
    this.actionSubmitted = false;

    if (this.app.gameScreen) this.app.gameScreen.classList.remove('hidden');
    if (this.refs.onlineMatchScreen) this.refs.onlineMatchScreen.classList.add('hidden');
    if (this.app.menuScreen) this.app.menuScreen.classList.add('hidden');
    if (this.app.worldTourScreen) this.app.worldTourScreen.classList.add('hidden');

    this.updateScoreboard(message.scores, message.shots, false);

    if (this.app.games && this.app.games.penaltis) {
      this.app.games.penaltis.onlineMyHistory = [];
      this.app.games.penaltis.onlineOppHistory = [];
      // ... resto de asignaciones de nombres y modos
    }

    // --- CAPTURA PRECISA SEGÚN EL FORMATO DE TU SERVIDOR ---
    if (this.app.games && this.app.games.penaltis) {
      let myName = 'Tú';
      let oppName = 'Rival';

      // Capturar tu nombre desde message.you
      if (message.you) {
        myName = message.you.nickname || message.you.name || message.you.username || 'Tú';
      }

      // Capturar el nombre del rival desde message.opponent
      if (message.opponent) {
        oppName = message.opponent.nickname || message.opponent.name || message.opponent.username || (typeof message.opponent === 'string' ? message.opponent : 'Rival');
      }

      // Respaldo por si el usuario actual tiene sesión local
      if (this.user && this.user.nickname) {
        myName = this.user.nickname;
      }

      this.app.games.penaltis.onlineMyName = typeof myName === 'string' ? myName : 'Tú';
      this.app.games.penaltis.onlineOppName = typeof oppName === 'string' ? oppName : 'Rival';
    }

    if (this.app.games && this.app.games.penaltis) {
      this.app.activeGameId = 'penaltis';
      this.app.activeGame = this.app.games.penaltis;
      this.app.gameState = 'playing';
      if (typeof this.app.games.penaltis.setOnlineMode === 'function') {
        this.app.games.penaltis.setOnlineMode(message, (zoneId) => {
          this.submitZoneAction(zoneId);
        });
      }
    }
  }

  showTurn(message) {
    this.currentRole = message.role; // 'shooter' o 'goalkeeper'
    this.actionSubmitted = false;

    // Traducir el rol a un texto claro para mostrar por pantalla
    const roleText = message.role === 'shooter' ? '🎯 ¡Te toca LANZAR!' : '🧤 ¡Te toca PARAR!';
    const roleColor = message.role === 'shooter' ? '#facc15' : '#38bdf8';

    if (this.refs.onlineTurnStatus) {
      this.refs.onlineTurnStatus.textContent = roleText;
      this.refs.onlineTurnStatus.style.color = roleColor;
    }

    this.updateScoreboard(message.scores, message.shots, message.suddenDeath);

    if (this.app.updateHUD) {
      this.app.updateHUD({
        score: message.scores[this.playerIndex],
        round: message.suddenDeath ? `MUERTE SÚBITA` : `Ronda ${message.round}/3`,
        history: []
      });
    }

    if (this.app.games && this.app.games.penaltis) {
      if (typeof this.app.games.penaltis.setOnlineTurn === 'function') {
        this.app.games.penaltis.setOnlineTurn(message);
      }
    }
  }

  showActionProgress(message) {
    if (message.youSubmitted) {
      this.actionSubmitted = true;
    }
  }

  submitZoneAction(zoneId) {
    if (!this.currentRole || this.actionSubmitted) return;
    if (!this.send({ type: 'action', zone: zoneId })) return;
    this.actionSubmitted = true;
  }

  showShotResult(message) {
    this.currentRole = null;
    const shooterIsYou = message.shooterIndex === this.playerIndex;
    const isGoal = message.result === 'goal';
    const outcome = isGoal ? 'goal' : 'saved';

    if (this.app.games && this.app.games.penaltis) {
      const historyRef = shooterIsYou 
        ? (this.app.games.penaltis.onlineMyHistory ||= []) 
        : (this.app.games.penaltis.onlineOppHistory ||= []);

      // Rellenar huecos previos si es necesario y asignar el resultado en el índice correcto
      const targetIndex = message.shots[message.shooterIndex] - 1;
      while (historyRef.length <= targetIndex) {
        historyRef.push(null);
      }
      historyRef[targetIndex] = outcome;
    }

    if (this.app.games && this.app.games.penaltis) {
      this.app.games.penaltis.onlineRole = shooterIsYou ? 'lanzador' : 'portero';
      if (typeof this.app.games.penaltis.triggerOnlineShotAnimation === 'function') {
        const currentTurnRole = shooterIsYou ? 'shooter' : 'goalkeeper';
        this.app.games.penaltis.triggerOnlineShotAnimation(message.shooterZone, message.keeperZone, currentTurnRole, isGoal);
      }
    }

    if (typeof this.app.showOnlineShotResultAnimation === 'function') {
      this.app.showOnlineShotResultAnimation(isGoal);
    }

    this.updateScoreboard(message.scores, message.shots, message.suddenDeath);
  }

  updateScoreboard(scores, shots, suddenDeath) {
    if (this.refs.onlineYouScore) this.refs.onlineYouScore.textContent = scores[this.playerIndex];
    if (this.refs.onlineOpponentScore) this.refs.onlineOpponentScore.textContent = scores[1 - this.playerIndex];
    if (this.refs.onlineYouShots) this.refs.onlineYouShots.textContent = `${shots[this.playerIndex]}/3`;
    if (this.refs.onlineOpponentShots) this.refs.onlineOpponentShots.textContent = `${shots[1 - this.playerIndex]}/3`;
    if (this.refs.suddenDeathBadge) this.refs.suddenDeathBadge.classList.toggle('hidden', !suddenDeath);

    if (this.app.games && this.app.games.penaltis) {
      this.app.games.penaltis.onlineMyScore = scores[this.playerIndex];
      this.app.games.penaltis.onlineOppScore = scores[1 - this.playerIndex];
      
      // Sincronizar el número total de tiros realizados para la muerte súbita
      this.app.games.penaltis.onlineMyShotsTotal = shots[this.playerIndex];
      this.app.games.penaltis.onlineOppShotsTotal = shots[1 - this.playerIndex];
    }
  }

  showOnlineResult(message) {
    this.matchActive = false;
    this.currentRole = null;
    if (this.refs.onlineMatchResult) this.refs.onlineMatchResult.classList.remove('hidden');
    if (this.refs.onlineResultTitle) {
      this.refs.onlineResultTitle.textContent = message.result === 'win' ? '¡Victoria!' : message.result === 'draw' ? 'Empate' : 'Derrota';
    }
    this.loadLeaderboard();
  }

  setStatus(msg, state = '') {}
  setQueueControlsEnabled(en) {}
}

window.OnlineArena = OnlineArena;