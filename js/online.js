class OnlineArena {
  constructor(app) {
    this.app = app;
    this.user = null;
    this.guestSessionPromise = null;
    this.socket = null;
    this.socketPromise = null;
    this.useServerlessMatchApi = window.location.protocol === 'https:';
    this.matchPollTimer = null;
    this.matchPollInFlight = false;
    this.matchPollStopped = true;
    this.matchId = null;
    this.matchEventCursor = 0;
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
      guestPrompt: document.getElementById('guestPrompt'),
      guestPromptText: document.getElementById('guestPromptText'),
      guestRegisterBtn: document.getElementById('guestRegisterBtn'),
      matchmakingBanner: document.getElementById('matchmakingBanner'),
      goalkeeperRoster: document.getElementById('goalkeeperRoster'),
      goalkeeperSelectionStatus: document.getElementById('goalkeeperSelectionStatus'),
      featuredKeeperPortrait: document.getElementById('featuredKeeperPortrait'),
      rankedMatchBtn: document.getElementById('rankedMatchBtn'),
      rankedActionType: document.getElementById('rankedActionType'),
      createFriendlyBtn: document.getElementById('createFriendlyBtn'),
      joinInviteForm: document.getElementById('joinInviteForm'),
      inviteCodeInput: document.getElementById('inviteCodeInput'),
      invitePanel: document.getElementById('invitePanel'),
      inviteCode: document.getElementById('inviteCode'),
      copyInviteBtn: document.getElementById('copyInviteBtn'),
      cancelOnlineBtn: document.getElementById('cancelOnlineBtn'),
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
      onlineResultMode: document.getElementById('onlineResultMode'),
      onlineResultIcon: document.getElementById('onlineResultIcon'),
      onlineResultTitle: document.getElementById('onlineResultTitle'),
      onlineResultSummary: document.getElementById('onlineResultSummary'),
      onlineRatingChange: document.getElementById('onlineRatingChange'),
      onlineResultYouName: document.getElementById('onlineResultYouName'),
      onlineResultYouScore: document.getElementById('onlineResultYouScore'),
      onlineResultOpponentName: document.getElementById('onlineResultOpponentName'),
      onlineResultOpponentScore: document.getElementById('onlineResultOpponentScore'),
      onlineResultRecord: document.getElementById('onlineResultRecord')
    };

    this.bindEvents();
    this.loadCurrentUser();
  }

  bindEvents() {
    this.refs.profileButton.addEventListener('click', () => this.openProfile());
    this.refs.guestRegisterBtn?.addEventListener('click', () => { this.openProfile(); this.setAuthMode('register'); });
    this.refs.goalkeeperRoster?.addEventListener('click', event => {
      const card = event.target.closest('[data-keeper-id]');
      if (card) this.selectGoalkeeper(card.dataset.keeperId);
    });
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
    document.getElementById('refreshLeaderboardBtn').addEventListener('click', () => this.loadLeaderboard());

    this.refs.forfeitOnlineBtn.addEventListener('click', () => {
      if (!this.matchActive || !window.confirm('¿Seguro que quieres abandonar la partida? Se contará como derrota.')) return;
      this.refs.forfeitOnlineBtn.disabled = true;
      if (this.useServerlessMatchApi) {
        this.requestMatchApi({ action: 'forfeit', matchId: this.matchId }).catch(error => {
          this.refs.forfeitOnlineBtn.disabled = false;
          this.setOnlineStatus(error.message, 'error');
        });
      } else {
        this.send({ type: 'forfeit' });
      }
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
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('La API no está disponible en esta publicación. En Vercel hay que desplegar también el backend y conectarlo a una base de datos persistente.');
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Solicitud fallida (${response.status}).`);
    return payload;
  }

  async loadCurrentUser() {
    try {
      const { user } = await this.api('/api/me');
      if (user || !this.user) this.setUser(user);
      if (user && this.useServerlessMatchApi) await this.resumeServerlessMatch();
    } catch (error) {}
    await this.loadLeaderboard();
  }

  async ensureGuestSession() {
    if (this.user) return this.user;
    if (!this.guestSessionPromise) {
      this.guestSessionPromise = this.api('/api/guest', { method: 'POST', body: '{}' })
        .then(({ user }) => { this.setUser(user); return user; })
        .finally(() => { this.guestSessionPromise = null; });
    }
    return this.guestSessionPromise;
  }

  async resumeServerlessMatch() {
    try {
      const state = await this.requestMatchApi({ action: 'poll', cursor: 0 });
      if (!['queued', 'waiting', 'active'].includes(state.status)) return;
      if (state.mode) this.currentMode = state.mode;
      if (state.code) {
        this.refs.inviteCode.textContent = state.code;
        this.refs.invitePanel.classList.remove('hidden');
      }
      this.refs.cancelOnlineBtn.classList.remove('hidden');
      this.setMatchmakingLoading(state.status === 'queued');
      this.refs.rankedMatchBtn.disabled = true;
      this.refs.createFriendlyBtn.disabled = true;
      this.refs.guestPrompt?.classList.add('hidden');
      this.startMatchPolling(state.matchId || null);
    } catch (error) {}
  }

  async loadLeaderboard() {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { entries } = await this.api('/api/leaderboard');
        if (!Array.isArray(entries)) throw new Error('La respuesta del ranking no tiene el formato esperado.');

        this.refs.leaderboardList.replaceChildren();
        const topTen = entries.slice(0, 10);
        if (!topTen.length) {
          this.refs.leaderboardList.append(this.makeLeaderboardMessage('Aún no hay jugadores en la clasificación. ¡Sé el primero en competir!'));
        } else {
          topTen.forEach(entry => this.refs.leaderboardList.append(this.makeLeaderboardRow(entry)));
        }
        if (this.user && !this.user.isGuest) this.updateRankBadge(this.user);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 600 * (attempt + 1)));
      }
    }

    console.error('No se pudo cargar el ranking:', lastError);
    this.refs.leaderboardList.replaceChildren(this.makeLeaderboardMessage('No se pudo cargar el ranking. Inténtalo de nuevo más tarde.'));
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
    if (entry.rank <= 3) row.classList.add(`leaderboard__row--rank-${entry.rank}`);
    if (this.user && this.user.nickname === entry.nickname) row.classList.add('is-current-player');
    const position = document.createElement('span');
    position.className = 'leaderboard__position';
    position.textContent = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`;
    if (entry.rank <= 3) position.setAttribute('aria-label', ['1.º puesto, oro', '2.º puesto, plata', '3.º puesto, bronce'][entry.rank - 1]);
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
    const previousRating = this.user?.rating;
    this.user = user || null;
    const isGuest = Boolean(this.user?.isGuest);
    const ratingCount = document.getElementById('headerRatingCount');
    if (ratingCount) ratingCount.textContent = this.user && !isGuest ? this.user.rating.toLocaleString('es-ES') : '—';
    ratingCount?.parentElement.classList.remove('is-up', 'is-down', 'is-updating');
    if (ratingCount && previousRating !== undefined && this.user && !isGuest && previousRating !== this.user.rating) {
      ratingCount.parentElement.classList.add(this.user.rating > previousRating ? 'is-up' : 'is-down', 'is-updating');
      window.setTimeout(() => ratingCount.parentElement.classList.remove('is-updating'), 850);
    }
    if (this.user) {
      this.refs.profileAvatar.textContent = this.user.avatar;
      this.refs.profileNickname.textContent = this.user.nickname;
    } else {
      this.refs.profileAvatar.textContent = '👤';
      this.refs.profileNickname.textContent = 'Entrar';
    }
    if (isGuest) {
    }
    this.refs.guestPrompt?.classList.toggle('hidden', Boolean(this.user && !isGuest) || this.refs.rankedMatchBtn.disabled);
    if (this.refs.rankedActionType) this.refs.rankedActionType.textContent = this.user && !isGuest ? 'PARTIDA CLASIFICATORIA' : 'PARTIDA NORMAL';
    if (this.refs.guestPromptText) this.refs.guestPromptText.textContent = isGuest
      ? `Estás jugando como ${this.user.nickname}. Crea una cuenta para ganar puntos y entrar en el ranking.`
      : 'Juega ya sin cuenta. Si quieres competir por puntos y entrar en el ranking, crea tu perfil.';
    if (!this.matchActive && !this.refs.rankedMatchBtn.disabled) this.setOnlineStatus(isGuest
      ? `Juegas como ${this.user.nickname}. Tus partidas no suman puntos.`
      : this.user ? 'Ya puedes buscar rival y competir por puntos.' : 'Puedes jugar como invitado. Crea una cuenta para sumar puntos.');
    this.updateFeaturedKeeperPortrait(this.user?.keeperId || 'rookie');
    this.renderGoalkeeperRoster();
    if (this.app.games?.penaltis) this.app.games.penaltis.setOnlineGoalkeeper(this.user?.keeperId || 'rookie');
  }

  updateFeaturedKeeperPortrait(keeperId) {
    const portrait = this.refs.featuredKeeperPortrait;
    const library = window.GOALKEEPER_ROSTER;
    if (!portrait || !library) return;
    const keeper = library.byId(keeperId);
    portrait.style.setProperty('--keeper-accent', keeper.colors[0]);
    portrait.src = `./assets/keeper-portrait-${keeper.id}.webp`;
  }

  renderGoalkeeperRoster() {
    const host = this.refs.goalkeeperRoster;
    const library = window.GOALKEEPER_ROSTER;
    if (!host || !library) return;
    const rating = this.user?.isGuest ? 1000 : Number(this.user?.rating) || 1000;
    const equipped = this.user?.keeperId || 'rookie';
    host.replaceChildren();
    library.roster.forEach(keeper => {
      const unlocked = rating >= keeper.unlockRating;
      const selected = keeper.id === equipped;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `keeper-card${selected ? ' is-equipped' : ''}${unlocked ? '' : ' is-locked'}`;
      card.dataset.keeperId = keeper.id;
      card.dataset.rarity = keeper.unlockRating >= 2000 ? 'legendary' : keeper.unlockRating >= 1600 ? 'epic' : keeper.unlockRating >= 1200 ? 'rare' : 'starter';
      card.style.setProperty('--keeper-accent', keeper.colors[0]);
      card.style.setProperty('--keeper-trim', keeper.colors[2]);
      card.disabled = selected;
      card.setAttribute('aria-label', `${keeper.name}: ${unlocked ? (selected ? 'equipado' : 'seleccionar') : `se desbloquea con ${keeper.unlockRating} puntos`}`);
      const portrait = document.createElement('canvas');
      portrait.className = 'keeper-card__portrait';
      portrait.setAttribute('aria-hidden', 'true');
      const lockNotice = document.createElement('span');
      lockNotice.className = 'keeper-card__lock-notice';
      lockNotice.setAttribute('aria-live', 'polite');
      lockNotice.textContent = `BLOQUEADO · ${keeper.unlockRating} PTS`;
      const info = document.createElement('span'); info.className = 'keeper-card__info';
      const name = document.createElement('strong'); name.textContent = keeper.name;
      const title = document.createElement('small'); title.textContent = keeper.title;
      const badge = document.createElement('span'); badge.className = 'keeper-card__badge';
      badge.textContent = selected ? 'EQUIPADO' : unlocked ? 'DESBLOQUEADO' : `${keeper.unlockRating} PTS`;
      info.append(name, title, badge); card.append(portrait, lockNotice, info); host.append(card);
      library.paintPortrait(portrait, keeper, selected);
    });
    this.refs.goalkeeperSelectionStatus.textContent = !this.user || this.user.isGuest
      ? 'Crea una cuenta para elegir y desbloquear porteros'
      : `${rating.toLocaleString('es-ES')} pts · ${library.roster.filter(item => rating >= item.unlockRating).length}/${library.roster.length} desbloqueados`;
  }

  async selectGoalkeeper(id) {
    const keeper = window.GOALKEEPER_ROSTER.byId(id);
    const rating = this.user?.isGuest ? 1000 : Number(this.user?.rating) || 1000;
    if (rating < keeper.unlockRating) {
      const card = this.refs.goalkeeperRoster.querySelector(`[data-keeper-id="${keeper.id}"]`);
      if (card) {
        card.classList.add('is-notice-visible');
        window.clearTimeout(card.lockNoticeTimer);
        card.lockNoticeTimer = window.setTimeout(() => card.classList.remove('is-notice-visible'), 1800);
      }
      return;
    }
    if (!this.user || this.user.isGuest) { this.openProfile(); return; }
    this.refs.goalkeeperSelectionStatus.textContent = 'Guardando elección…';
    try {
      const { user } = await this.api('/api/goalkeeper', { method: 'PUT', body: JSON.stringify({ keeperId: id }) });
      this.setUser(user);
      this.refs.goalkeeperSelectionStatus.textContent = `${window.GOALKEEPER_ROSTER.byId(id).name} equipado para el próximo duelo`;
    } catch (error) {
      this.refs.goalkeeperSelectionStatus.textContent = error.message;
    }
  }

  setOnlineStatus(message, state = '') {
    this.refs.onlineStatus.textContent = message;
    this.refs.onlineStatus.classList.toggle('is-error', state === 'error');
    this.refs.onlineStatus.classList.toggle('is-success', state === 'success');
    if (state === 'error') this.setMatchmakingLoading(false);
  }

  setMatchmakingLoading(visible) {
    this.refs.matchmakingBanner?.classList.toggle('hidden', !visible);
  }

  openProfile() {
    this.refs.profileForm.reset();
    this.refs.profileModal.classList.remove('hidden');
    this.refs.profileModal.classList.add('flex');
    if (this.user && !this.user.isGuest) {
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
    if (this.user && !this.user.isGuest) return;
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
    if (this.authMode !== 'profile' && (this.matchActive || this.refs.rankedMatchBtn.disabled)) {
      this.refs.profileFormStatus.textContent = 'Termina o cancela la partida antes de cambiar de cuenta.';
      this.refs.profileFormStatus.classList.add('is-error');
      return;
    }
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
      if (this.authMode !== 'profile' && this.socket) { this.socket.close(); this.socket = null; }
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
    await this.ensureGuestSession();
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

  async requestMatchApi(body) {
    return this.api('/api/match', { method: 'POST', body: JSON.stringify(body) });
  }

  startMatchPolling(matchId = null) {
    this.stopMatchPolling();
    this.matchId = matchId;
    this.matchEventCursor = 0;
    this.matchPollStopped = false;
    this.pollMatchApi();
  }

  stopMatchPolling() {
    this.matchPollStopped = true;
    this.matchPollInFlight = false;
    if (this.matchPollTimer) window.clearTimeout(this.matchPollTimer);
    this.matchPollTimer = null;
  }

  async pollMatchApi() {
    if (this.matchPollStopped || this.matchPollInFlight) return;
    this.matchPollInFlight = true;
    let nextDelay = 1100;
    try {
      const state = await this.requestMatchApi({
        action: 'poll',
        matchId: this.matchId,
        cursor: this.matchEventCursor
      });
      if (state.matchId) this.matchId = state.matchId;
      if (state.mode) this.currentMode = state.mode;
      if (state.code) {
        this.refs.inviteCode.textContent = state.code;
        this.refs.invitePanel.classList.remove('hidden');
      }
      for (const message of state.events || []) {
        this.matchEventCursor = Math.max(this.matchEventCursor, Number(message.eventId) || 0);
        this.handleSocketMessage({ data: JSON.stringify(message) });
      }
      if (Number.isSafeInteger(Number(state.cursor))) {
        this.matchEventCursor = Math.max(this.matchEventCursor, Number(state.cursor));
      }
      if (state.progress) this.showActionProgress(state.progress);

      this.setMatchmakingLoading(state.status === 'queued');
      if (state.status === 'queued') this.setOnlineStatus('Buscando rival. Te avisaremos en cuanto empiece el duelo.');
      if (state.status === 'waiting' && this.currentMode === 'friendly') this.setOnlineStatus('Invitación lista. Esperando a tu amigo.');
      if (state.status === 'finished' || state.status === 'expired' || state.status === 'cancelled' || state.status === 'idle') {
        this.stopMatchPolling();
        if (state.status !== 'finished') this.resetOnlineControls();
        return;
      }
    } catch (error) {
      nextDelay = 2200;
      if (error.message.includes('Inicia sesión')) {
        this.stopMatchPolling();
        this.resetOnlineControls();
      } else if (this.matchActive) {
        this.setOnlineStatus('Reconectando con el servidor de la partida…', 'error');
      } else {
        this.setOnlineStatus(error.message, 'error');
        this.stopMatchPolling();
        this.resetOnlineControls();
      }
    } finally {
      this.matchPollInFlight = false;
      if (!this.matchPollStopped) this.matchPollTimer = window.setTimeout(() => this.pollMatchApi(), nextDelay);
    }
  }

  resetOnlineControls() {
    this.setMatchmakingLoading(false);
    this.refs.cancelOnlineBtn.classList.add('hidden');
    this.refs.rankedMatchBtn.disabled = false;
    this.refs.createFriendlyBtn.disabled = false;
    this.refs.guestPrompt?.classList.toggle('hidden', Boolean(this.user && !this.user.isGuest));
    this.refs.forfeitOnlineBtn.disabled = false;
  }

  async startRankedQueue() {
    this.setMatchmakingLoading(true);
    this.refs.cancelOnlineBtn.classList.remove('hidden');
    this.refs.rankedMatchBtn.disabled = true;
    this.refs.createFriendlyBtn.disabled = true;
    this.refs.guestPrompt?.classList.add('hidden');
    this.setOnlineStatus('Buscando rival para el duelo…');
    try {
      await this.ensureGuestSession();
      if (this.useServerlessMatchApi) {
        const result = await this.requestMatchApi({ action: 'queue' });
        if (result.matchId) this.startMatchPolling(result.matchId);
        else this.startMatchPolling();
        return;
      }
      await this.ensureSocket();
      this.send({ type: 'queue-ranked' });
    } catch (error) {
      this.resetOnlineControls();
      this.setOnlineStatus('No se pudo conectar con el servicio de partidas online.', 'error');
    }
  }

  async createFriendlyMatch() {
    this.setMatchmakingLoading(false);
    this.currentMode = 'friendly';
    this.refs.cancelOnlineBtn.classList.remove('hidden');
    this.refs.rankedMatchBtn.disabled = true;
    this.refs.createFriendlyBtn.disabled = true;
    this.refs.guestPrompt?.classList.add('hidden');
    this.setOnlineStatus('Preparando una invitación para tu amigo.');
    try {
      await this.ensureGuestSession();
      if (this.useServerlessMatchApi) {
        const result = await this.requestMatchApi({ action: 'invite' });
        this.refs.inviteCode.textContent = result.code;
        this.refs.invitePanel.classList.remove('hidden');
        this.setOnlineStatus('Invitación lista. Comparte el código con tu amigo.', 'success');
        this.startMatchPolling(result.matchId);
        return;
      }
      await this.ensureSocket();
      this.send({ type: 'create-invite' });
    } catch (error) {
      this.resetOnlineControls();
      this.setOnlineStatus('No se pudo crear la invitación.', 'error');
    }
  }

  async joinFriendlyMatch() {
    this.setMatchmakingLoading(false);
    const code = this.refs.inviteCodeInput.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return;
    this.refs.cancelOnlineBtn.classList.remove('hidden');
    this.refs.rankedMatchBtn.disabled = true;
    this.refs.createFriendlyBtn.disabled = true;
    this.refs.guestPrompt?.classList.add('hidden');
    this.setOnlineStatus('Conectando con la partida…');
    try {
      await this.ensureGuestSession();
      if (this.useServerlessMatchApi) {
        const result = await this.requestMatchApi({ action: 'join-invite', code });
        this.currentMode = 'friendly';
        this.startMatchPolling(result.matchId);
        return;
      }
      await this.ensureSocket();
      this.send({ type: 'join-invite', code });
    } catch (error) {
      this.resetOnlineControls();
      this.setOnlineStatus('No se pudo conectar con la partida.', 'error');
    }
  }

  cancelQueue() {
    this.setMatchmakingLoading(false);
    if (this.useServerlessMatchApi) {
      this.stopMatchPolling();
      this.requestMatchApi({ action: 'cancel' }).catch(() => {});
      this.resetOnlineControls();
      this.setOnlineStatus('Búsqueda cancelada. Puedes volver a buscar rival.');
      this.refs.invitePanel.classList.add('hidden');
      return;
    }
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
        this.setOnlineStatus('Invitación lista. Comparte el código con tu amigo.', 'success');
        break;
      case 'queue-wait':
        this.setMatchmakingLoading(true);
        this.setOnlineStatus('Buscando rival online…');
        break;
      case 'queue-matched':
        this.setMatchmakingLoading(false);
        this.setOnlineStatus('Rival encontrado. Preparando el duelo…', 'success');
        break;
      case 'cancelled':
        this.resetOnlineControls();
        this.refs.invitePanel.classList.add('hidden');
        this.setOnlineStatus('Búsqueda cancelada. Puedes volver a buscar rival.');
        break;
      case 'error':
        this.resetOnlineControls();
        this.setOnlineStatus(message.message || 'No se pudo completar la acción.', 'error');
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
    this.setMatchmakingLoading(false);
    if (message.matchId) this.matchId = message.matchId;
    this.currentMode = message.mode;
    this.playerIndex = message.playerIndex;
    this.matchActive = true;
    this.actionSubmitted = false;
    const you = message.you || this.user || {};
    const opponent = message.opponent || {};
    const isNormal = message.mode === 'ranked' && (you.isGuest || opponent.isGuest);
    this.refs.onlineMatchMode.textContent = message.mode === 'friendly' ? 'AMISTOSA' : isNormal ? 'PARTIDA NORMAL' : 'CLASIFICATORIA';
    this.youKeeperId = you.keeperId || this.user?.keeperId || 'rookie';
    this.opponentKeeperId = opponent.keeperId || 'rookie';
    this.refs.onlineYouAvatar.textContent = you.avatar || '⚽';
    this.refs.onlineYouName.textContent = you.nickname || 'Tú';
    this.refs.onlineYouMeta.textContent = isNormal ? 'SIN PUNTOS' : you.isGuest ? 'INVITADO' : `${you.rating ?? 1000} pts`;
    this.refs.onlineOpponentAvatar.textContent = opponent.avatar || '⚽';
    this.refs.onlineOpponentName.textContent = opponent.nickname || 'Rival';
    this.refs.onlineOpponentMeta.textContent = isNormal ? 'SIN PUNTOS' : opponent.isGuest ? 'INVITADO' : `${opponent.rating ?? 1000} pts`;

    if (this.app.gameScreen) this.app.gameScreen.classList.remove('hidden');
    if (this.refs.onlineMatchScreen) this.refs.onlineMatchScreen.classList.add('hidden');
    this.refs.forfeitOnlineBtn.classList.remove('hidden');
    document.getElementById('pauseBtn')?.classList.add('hidden');
    this.refs.onlineMatchResult.classList.add('hidden');
    this.refs.cancelOnlineBtn.classList.add('hidden');
    if (this.app.menuScreen) this.app.menuScreen.classList.add('hidden');

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
    if (this.useServerlessMatchApi) {
      this.actionSubmitted = true;
      this.requestMatchApi({ action: 'action', matchId: this.matchId, zone: zoneId }).catch(error => {
        this.actionSubmitted = false;
        this.setOnlineStatus(error.message, 'error');
      });
      return;
    }
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
      const defendingKeeper = shooterIsYou ? this.opponentKeeperId : this.youKeeperId;
      this.app.games.penaltis.setOnlineGoalkeeper(defendingKeeper);
      this.app.games.penaltis.onlineRole = shooterIsYou ? 'lanzador' : 'portero';
      if (typeof this.app.games.penaltis.triggerOnlineShotAnimation === 'function') {
        const currentTurnRole = shooterIsYou ? 'shooter' : 'goalkeeper';
        const shooterZone = message.shooterZone || message.shotZone;
        const keeperZone = message.keeperZone || message.saveZone;
        this.app.games.penaltis.triggerOnlineShotAnimation(shooterZone, keeperZone, currentTurnRole, isGoal);
      }
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
    this.stopMatchPolling();
    this.matchActive = false;
    this.currentRole = null;
    this.resetOnlineControls();
    this.refs.invitePanel.classList.add('hidden');
    const won = message.result === 'win';
    const draw = message.result === 'draw';
    const opponent = message.opponent || {};
    const scores = message.scores || [0, 0];
    const youScore = scores[this.playerIndex] ?? 0;
    const opponentScore = scores[1 - this.playerIndex] ?? 0;
    const rating = message.rating || {};
    const delta = Number(rating.delta) || 0;
    const updatedUser = message.user || this.user;
    const ranked = message.mode === 'ranked' && !updatedUser?.isGuest && !opponent.isGuest;
    const normal = message.mode === 'ranked' && !ranked;

    if (updatedUser) this.setUser(updatedUser);
    this.app.gameState = 'online-result';
    this.app.gameScreen?.classList.add('hidden');
    this.refs.onlineMatchResult.classList.remove('hidden', 'is-win', 'is-loss', 'is-draw');
    this.refs.onlineMatchResult.classList.add(won ? 'is-win' : draw ? 'is-draw' : 'is-loss');
    this.refs.onlineMatchScreen.classList.remove('hidden');
    this.refs.forfeitOnlineBtn.classList.add('hidden');

    this.refs.onlineResultMode.textContent = ranked ? 'PARTIDA CLASIFICATORIA' : normal ? 'PARTIDA NORMAL' : 'PARTIDA AMISTOSA';
    this.refs.onlineResultIcon.textContent = won ? '🏆' : draw ? '🤝' : '⚡';
    this.refs.onlineResultTitle.textContent = won ? '¡Victoria!' : draw ? 'Empate' : 'Derrota';
    let reason = '';
    if (message.reason === 'forfeit') reason = won ? ' · victoria por abandono' : ' · partida por abandono';
    if (message.reason === 'disconnect') reason = won ? ' · victoria por desconexión' : ' · partida interrumpida';
    this.refs.onlineResultSummary.textContent = `Duelo contra ${opponent.nickname || 'Rival'}${reason}`;
    this.refs.onlineResultYouName.textContent = this.user?.nickname || 'Tú';
    this.refs.onlineResultOpponentName.textContent = opponent.nickname || 'Rival';
    this.refs.onlineResultYouScore.textContent = youScore;
    this.refs.onlineResultOpponentScore.textContent = opponentScore;

    this.refs.onlineRatingChange.classList.remove('is-up', 'is-down');
    if (!ranked) {
      this.refs.onlineRatingChange.textContent = normal ? 'PARTIDA NORMAL · SIN CAMBIO DE PUNTOS' : 'AMISTOSA · SIN CAMBIO DE PUNTOS';
    } else if (delta > 0) {
      this.refs.onlineRatingChange.textContent = `+${delta} PTS · TOTAL ${updatedUser?.rating ?? rating.after ?? '—'}`;
      this.refs.onlineRatingChange.classList.add('is-up');
    } else if (delta < 0) {
      this.refs.onlineRatingChange.textContent = `${delta} PTS · TOTAL ${updatedUser?.rating ?? rating.after ?? '—'}`;
      this.refs.onlineRatingChange.classList.add('is-down');
    } else {
      this.refs.onlineRatingChange.textContent = `SIN CAMBIO · ${updatedUser?.rating ?? rating.after ?? '—'} PTS`;
    }

    const record = updatedUser ? `${updatedUser.wins ?? 0} victorias · ${updatedUser.losses ?? 0} derrotas` : '';
    const rank = updatedUser?.rank ? ` · puesto #${updatedUser.rank}` : '';
    this.refs.onlineResultRecord.textContent = ranked ? `${record}${rank}` : updatedUser?.isGuest
      ? 'Crea una cuenta para competir en el ranking' : 'Esta partida no altera el ranking';
    this.loadLeaderboard();
  }

  setStatus(msg, state = '') {}
  setQueueControlsEnabled(en) {}
}

window.OnlineArena = OnlineArena;
