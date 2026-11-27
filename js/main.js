(function () {
  const C = window.QB.C;
  const el = id => document.getElementById(id);
  const screens = {
    menu: el('menuScreen'),
    lobby: el('lobbyScreen'),
    game: el('gameScreen'),
    gameover: el('gameOverScreen')
  };
  const canvas = el('gameCanvas');
  const context = canvas.getContext('2d');
  const keys = new Set();
  let state = null;
  let isHost = false;
  let roomCode = '';
  let localIndex = 0;
  let currentScreen = '';
  let lastFrame = performance.now();
  let lastBroadcast = 0;
  let lastHudUpdate = 0;
  let lastLobbyBroadcast = 0;
  let lastInputSend = 0;
  let notice = '';

  function setStatus(element, message, isError) {
    element.textContent = message || '';
    element.classList.toggle('error', Boolean(isError));
  }

  function showScreen(name) {
    if (currentScreen === name) return;
    currentScreen = name;
    document.body.classList.toggle('game-mode', name === 'game');
    Object.keys(screens).forEach(key => { screens[key].hidden = key !== name; });
  }

  function playerName() {
    return (el('playerName').value.trim() || 'Jogador').slice(0, 16);
  }

  function movementInput() {
    if (!state) return 0;
    const side = window.QB.Physics.getSideGeometry(state.playerCount, localIndex);
    const horizontal = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
    const vertical = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
    return Math.max(-1, Math.min(1, horizontal * side.tangent.x + vertical * side.tangent.y));
  }

  function renderLobby() {
    if (!state) return;
    el('roomCodeLabel').textContent = roomCode || '----';
    const seatList = el('seatList');
    seatList.innerHTML = state.players.map(player => {
      const status = player.bot ? 'BOT' : player.connected ? (player.index === localIndex ? 'VOCÊ' : 'ONLINE') : 'AGUARDANDO';
      return `<div class="seat-card">
        <span class="seat-color" style="color:${player.color};background:${player.color}"></span>
        <span class="seat-main">
          <span class="seat-name">${escapeHtml(player.name)}</span>
          <span class="seat-side">${escapeHtml(player.sideName)} • ${escapeHtml(player.label)}</span>
        </span>
        <span class="seat-status ${player.connected || player.bot ? 'online' : ''}">${status}</span>
      </div>`;
    }).join('');
    el('lobbyOptions').hidden = !isHost;
    el('lobbyContent').classList.toggle('client-lobby', !isHost);
    el('startGameBtn').hidden = !isHost;
    el('copyInviteBtn').hidden = !isHost;
    const ownPlayer = state.players[localIndex];
    el('playerColorInput').value = ownPlayer.color;
    el('playerColorInput').disabled = state.phase !== 'LOBBY';
    el('playerCountInput').value = String(state.playerCount);
    const lastConnectedIndex = state.players.reduce((last, player) => player.connected ? Math.max(last, player.index) : last, 0);
    Array.from(el('playerCountInput').options).forEach(option => {
      option.disabled = Number(option.value) <= lastConnectedIndex && Number(option.value) < state.playerCount;
    });
    el('lobbyStatus').textContent = notice || (isHost
      ? 'Compartilhe o código. As vagas vazias viram bots ao iniciar.'
      : 'Aguardando o anfitrião iniciar a partida.');
  }

  function showGame() {
    const enteringGame = currentScreen !== 'game';
    showScreen('game');
    if (enteringGame) {
      el('gameRoomLabel').textContent = `Sala ${roomCode} • ${state.players[localIndex].sideName} (${state.players[localIndex].label})`;
      el('connectionLabel').textContent = isHost ? 'HOST' : 'CONECTADO';
      renderHud();
      requestAnimationFrame(resizeArena);
    }
  }

  function resizeArena() {
    if (currentScreen !== 'game') return;
    const gameScreen = el('gameScreen');
    const arena = gameScreen.querySelector('.arena-frame');
    const otherElements = Array.from(gameScreen.children).filter(element =>
      element !== arena && !element.hidden && window.getComputedStyle(element).display !== 'none'
    );
    const gap = Number.parseFloat(window.getComputedStyle(gameScreen).gap) || 0;
    const shellStyle = window.getComputedStyle(el('appShell'));
    const verticalPadding = (Number.parseFloat(shellStyle.paddingTop) || 0) + (Number.parseFloat(shellStyle.paddingBottom) || 0);
    const occupiedHeight = otherElements.reduce((total, element) => total + element.getBoundingClientRect().height, 0)
      + gap * otherElements.length
      + verticalPadding;
    const availableHeight = Math.floor(window.innerHeight - occupiedHeight);
    const availableWidth = Math.floor(Math.min(1100, window.innerWidth * 0.96, availableHeight));
    gameScreen.style.setProperty('--arena-size', `${Math.max(280, availableWidth)}px`);
  }

  function renderHud() {
    if (!state) return;
    window.QB.Renderer.renderScoreboard(el('scoreboard'), state.players);
    const seconds = Math.max(0, Math.ceil(state.timeLeftMs / 1000));
    const minutes = Math.floor(seconds / 60);
    el('gameTimer').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const respawnTimer = el('brickRespawnTimer');
    if (state.bricks.length === 0 && state.bricksRespawnMs > 0) {
      respawnTimer.textContent = `Blocos reaparecem em ${Math.ceil(state.bricksRespawnMs / 1000)}s`;
      respawnTimer.hidden = false;
    } else {
      respawnTimer.hidden = true;
    }
    el('gameHint').textContent = state.balls.length > 1
      ? `${state.balls.length} bolas em jogo • Destrua blocos roxos para espalhar multibolas.`
      : 'Destrua blocos, defenda sua borda e mande a bola para os adversários.';
  }

  function showGameOver() {
    showScreen('gameover');
    if (!state) return;
    const winner = state.players.find(player => player.index === state.winnerIndex);
    el('winnerText').textContent = state.isDraw ? 'Empate!' : `${winner ? winner.name : 'Jogador'} venceu!`;
    el('winnerText').style.color = winner ? winner.color : '';
    el('finalScores').innerHTML = state.players.map(player =>
      `<div class="final-score" style="border-color:${player.color}66;color:${player.color}">${escapeHtml(player.name)} · ${player.score}</div>`
    ).join('');
  }

  function updatePhase() {
    if (!state) return;
    if (state.phase === 'LOBBY') {
      showScreen('lobby');
      renderLobby();
    } else if (state.phase === 'PLAYING') showGame();
    else if (state.phase === 'GAMEOVER') showGameOver();
  }

  function makeNetworkHandlers() {
    return {
      onJoin(name, peerId) {
        if (!state || state.phase !== 'LOBBY') return -1;
        const player = state.players.find(entry => entry.index > 0 && !entry.connected);
        if (!player) return -1;
        player.id = peerId;
        player.name = name;
        player.connected = true;
        player.bot = false;
        notice = `${name} entrou na sala.`;
        return player.index;
      },
      onInput(index, move) {
        const player = state && state.players[index];
        if (state && state.phase === 'PLAYING' && player && player.connected && !player.bot) player.move = move;
      },
      onColor(index, color) {
        if (!setPlayerColor(index, color)) return false;
        notice = `${state.players[index].name} escolheu ${state.players[index].label}.`;
        return true;
      },
      onDisconnect(index) {
        const player = state && state.players[index];
        if (!player) return;
        player.connected = false;
        player.id = null;
        player.move = 0;
        if (state.phase === 'PLAYING') {
          player.bot = true;
          player.name = `Bot ${player.sideName}`;
        } else {
          player.bot = false;
          player.name = `Vaga ${player.label}`;
        }
        notice = `${player.label}: ${state.phase === 'PLAYING' ? 'bot assumiu a vaga.' : 'jogador saiu.'}`;
      },
      onLobbyChange() {
        renderLobby();
        window.QB.Network.broadcastState(state);
      },
      onError(message) {
        notice = message;
        setStatus(el('menuStatus'), message, true);
        el('connectionLabel').textContent = 'DESCONECTADO';
        if (state && state.phase === 'LOBBY') renderLobby();
      }
    };
  }

  async function createRoom() {
    const button = el('createRoomBtn');
    button.disabled = true;
    setStatus(el('menuStatus'), 'Criando sala...', false);
    try {
      state = window.QB.Physics.createLobbyState(playerName(), 'host');
      isHost = true;
      localIndex = 0;
      roomCode = await window.QB.Network.createHost(makeNetworkHandlers());
      notice = 'Sala criada. Compartilhe o código com seus amigos.';
      el('roomCodeInput').value = roomCode;
      renderLobby();
      showScreen('lobby');
    } catch (error) {
      state = null;
      isHost = false;
      setStatus(el('menuStatus'), error.message || 'Não foi possível criar a sala.', true);
    } finally {
      button.disabled = false;
    }
  }

  async function joinRoom() {
    const code = el('roomCodeInput').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      setStatus(el('menuStatus'), 'Digite um código válido com 4 letras.', true);
      return;
    }
    const button = el('joinRoomBtn');
    button.disabled = true;
    setStatus(el('menuStatus'), 'Conectando à sala...', false);
    isHost = false;
    roomCode = code;
    try {
      await window.QB.Network.joinRoom(code, playerName(), {
        onWelcome(index) {
          localIndex = index;
          showScreen('lobby');
        },
        onState(receivedState) {
          state = receivedState;
          if (state.phase === 'LOBBY') renderLobby();
          updatePhase();
        },
        onColorRejected(message) {
          notice = message || 'Não foi possível escolher essa cor.';
          renderLobby();
        },
        onError(message) {
          notice = message;
          el('connectionLabel').textContent = 'DESCONECTADO';
          setStatus(el('menuStatus'), message, true);
        }
      });
      setStatus(el('menuStatus'), '', false);
    } catch (error) {
      setStatus(el('menuStatus'), error.message || 'Não foi possível entrar na sala.', true);
      window.QB.Network.leave();
    } finally {
      button.disabled = false;
    }
  }

  function startGame() {
    if (!isHost || !state || state.phase !== 'LOBBY') return;
    const duration = Number(el('durationInput').value);
    const scoreLimit = Number(el('scoreLimitInput').value);
    window.QB.Physics.startMatch(state, duration, scoreLimit, undefined, el('multiballIntervalInput').value);
    notice = '';
    updatePhase();
    window.QB.Network.broadcastState(state);
  }

  function changePlayerCount() {
    if (!isHost || !state || state.phase !== 'LOBBY') return;
    const previousCount = state.playerCount;
    if (!window.QB.Physics.configurePlayerCount(state, el('playerCountInput').value)) {
      el('playerCountInput').value = String(previousCount);
      notice = 'Não é possível remover uma vaga ocupada.';
      renderLobby();
      return;
    }
    notice = `Arena configurada para ${state.playerCount} jogadores.`;
    renderLobby();
    window.QB.Network.broadcastState(state);
  }

  function setPlayerColor(index, color) {
    if (!state || state.phase !== 'LOBBY') return false;
    const player = state.players[index];
    if (!player || !/^#[0-9a-f]{6}$/i.test(color)) return false;
    const choice = C.PLAYERS.find(palette => palette.color.toLowerCase() === color.toLowerCase());
    player.color = color.toUpperCase();
    player.label = choice ? choice.label : 'Personalizada';
    return true;
  }

  function changePlayerColor() {
    if (!state || state.phase !== 'LOBBY') return;
    const color = el('playerColorInput').value;
    if (isHost) {
      if (!setPlayerColor(localIndex, color)) {
        notice = 'Não foi possível aplicar essa cor.';
        renderLobby();
        return;
      }
      notice = `Você escolheu ${state.players[localIndex].label}.`;
      renderLobby();
      window.QB.Network.broadcastState(state);
    } else {
      window.QB.Network.sendColor(color);
    }
  }

  async function copyInvite() {
    if (!roomCode) return;
    const invite = new URL(location.href);
    invite.search = '';
    invite.hash = '';
    invite.searchParams.set('room', roomCode);
    try {
      await navigator.clipboard.writeText(invite.href);
      notice = 'Convite copiado.';
    } catch (error) {
      notice = `Código da sala: ${roomCode}`;
    }
    renderLobby();
  }

  function returnToMenu() {
    window.QB.Network.leave();
    state = null;
    isHost = false;
    roomCode = '';
    localIndex = 0;
    keys.clear();
    notice = '';
    showScreen('menu');
    setStatus(el('menuStatus'), '', false);
  }

  function onKey(event, down) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) {
      event.preventDefault();
      if (down) keys.add(key);
      else keys.delete(key);
    }
  }

  function loop(now) {
    const elapsed = Math.min(34, Math.max(0, now - lastFrame));
    lastFrame = now;
    if (state && state.phase === 'PLAYING') {
      if (isHost) {
        const move = movementInput();
        window.QB.Physics.step(state, elapsed, { 0: move });
        if (state.phase === 'GAMEOVER') {
          updatePhase();
          window.QB.Network.broadcastState(state);
          lastBroadcast = now;
        }
      } else if (now - lastInputSend >= C.BROADCAST_INTERVAL_MS) {
        window.QB.Network.sendInput(movementInput());
        lastInputSend = now;
      }
      if (isHost && now - lastBroadcast >= C.BROADCAST_INTERVAL_MS) {
        window.QB.Network.broadcastState(state);
        lastBroadcast = now;
      }
      if (now - lastHudUpdate >= 120) {
        renderHud();
        lastHudUpdate = now;
      }
    } else if (state && state.phase === 'LOBBY' && isHost && now - lastLobbyBroadcast >= 500) {
      window.QB.Network.broadcastState(state);
      lastLobbyBroadcast = now;
    }

    if (state && (currentScreen === 'game' || currentScreen === 'lobby')) {
      window.QB.Renderer.draw(context, state);
    }
    requestAnimationFrame(loop);
  }

  function init() {
    el('createRoomBtn').addEventListener('click', createRoom);
    el('joinRoomBtn').addEventListener('click', joinRoom);
    el('startGameBtn').addEventListener('click', startGame);
    el('copyInviteBtn').addEventListener('click', copyInvite);
    el('leaveGameBtn').addEventListener('click', returnToMenu);
    el('playerCountInput').addEventListener('change', changePlayerCount);
    el('playerColorInput').addEventListener('change', changePlayerColor);
    el('roomCodeInput').addEventListener('input', event => { event.target.value = event.target.value.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase(); });
    el('roomCodeInput').addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });
    const inviteCode = new URLSearchParams(location.search).get('room');
    if (inviteCode && /^[A-Z]{4}$/i.test(inviteCode)) el('roomCodeInput').value = inviteCode.toUpperCase();
    window.addEventListener('keydown', event => onKey(event, true));
    window.addEventListener('keyup', event => onKey(event, false));
    window.addEventListener('blur', () => keys.clear());
    window.addEventListener('resize', resizeArena);
    window.addEventListener('beforeunload', () => window.QB.Network.leave());
    document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
    requestAnimationFrame(loop);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  init();
})();
