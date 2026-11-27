(function () {
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let peer = null;
  let host = false;
  let hostConnection = null;
  let connections = new Map();
  let handlers = {};

  function makeCode() {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return code;
  }

  function getPeerConstructor() {
    return window.Peer || (typeof Peer === 'function' ? Peer : null);
  }

  function createHost(callbacks) {
    const PeerConstructor = getPeerConstructor();
    if (!PeerConstructor) return Promise.reject(new Error('PeerJS não carregou. Verifique a conexão e atualize a página.'));
    leave();
    handlers = callbacks || {};
    host = true;
    const code = makeCode();

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        leave();
        reject(new Error('O servidor de salas demorou demais para responder. Tente novamente.'));
      }, 15000);
      peer = new PeerConstructor(`qb-${code.toLowerCase()}`, { debug: 0 });
      peer.on('open', () => {
        clearTimeout(timeout);
        settled = true;
        resolve(code);
      });
      peer.on('connection', connection => acceptConnection(connection));
      peer.on('error', error => {
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          leave();
          reject(new Error(networkError(error)));
        } else if (handlers.onError) handlers.onError(networkError(error));
      });
      peer.on('disconnected', () => {
        if (handlers.onError) handlers.onError('Conexão de rede interrompida. Tente novamente.');
      });
    });
  }

  function acceptConnection(connection) {
    let playerIndex = null;
    connection.on('data', message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'join' && playerIndex === null) {
        playerIndex = handlers.onJoin ? handlers.onJoin(String(message.name || 'Jogador').slice(0, 16), connection.peer) : -1;
        if (!Number.isInteger(playerIndex) || playerIndex < 1 || playerIndex > 7) {
          connection.send({ type: 'rejected', reason: 'A sala já começou ou está cheia.' });
          connection.close();
          return;
        }
        connections.set(connection.peer, { connection, playerIndex });
        connection.send({ type: 'welcome', playerIndex });
        if (handlers.onLobbyChange) handlers.onLobbyChange();
        return;
      }
      if (message.type === 'input' && playerIndex !== null && handlers.onInput) {
        const move = Number(message.move);
        handlers.onInput(playerIndex, Number.isFinite(move) ? Math.max(-1, Math.min(1, move)) : 0);
      }
    });
    connection.on('close', () => {
      if (playerIndex !== null && connections.has(connection.peer)) {
        connections.delete(connection.peer);
        if (handlers.onDisconnect) handlers.onDisconnect(playerIndex);
        if (handlers.onLobbyChange) handlers.onLobbyChange();
      }
    });
    connection.on('error', error => {
      if (handlers.onError) handlers.onError(networkError(error));
    });
  }

  function joinRoom(code, name, callbacks) {
    const PeerConstructor = getPeerConstructor();
    if (!PeerConstructor) return Promise.reject(new Error('PeerJS não carregou. Verifique a conexão e atualize a página.'));
    leave();
    handlers = callbacks || {};
    host = false;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        leave();
        reject(new Error('A sala não respondeu. Confira o código e tente novamente.'));
      }, 20000);
      peer = new PeerConstructor({ debug: 0 });
      peer.on('open', () => {
        hostConnection = peer.connect(`qb-${code.toLowerCase()}`, { reliable: true });
        hostConnection.on('open', () => hostConnection.send({ type: 'join', name }));
        hostConnection.on('data', message => {
          if (!message || typeof message !== 'object') return;
          if (message.type === 'welcome' && !settled) {
            clearTimeout(timeout);
            settled = true;
            if (handlers.onWelcome) handlers.onWelcome(message.playerIndex);
            resolve(message.playerIndex);
          } else if (message.type === 'state' && handlers.onState) handlers.onState(message.state);
          else if (message.type === 'rejected' && !settled) {
            clearTimeout(timeout);
            settled = true;
            reject(new Error(message.reason || 'Não foi possível entrar na sala.'));
            leave();
          }
        });
        hostConnection.on('close', () => {
          if (!settled) {
            clearTimeout(timeout);
            settled = true;
            reject(new Error('A conexão com o anfitrião foi encerrada.'));
          } else if (handlers.onError) handlers.onError('A conexão com o anfitrião foi encerrada.');
        });
        hostConnection.on('error', error => {
          if (!settled) {
            clearTimeout(timeout);
            settled = true;
            reject(new Error(networkError(error)));
            leave();
          } else if (handlers.onError) handlers.onError(networkError(error));
        });
      });
      peer.on('error', error => {
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          reject(new Error(networkError(error)));
          leave();
        } else if (handlers.onError) handlers.onError(networkError(error));
      });
    });
  }

  function sendInput(move) {
    if (!host && hostConnection && hostConnection.open) hostConnection.send({ type: 'input', move });
  }

  function broadcastState(state) {
    if (!host) return;
    const snapshot = {
      ...state,
      players: state.players.map(({ move, ...player }) => ({ ...player })),
      balls: state.balls.map(ball => ({ ...ball, trail: ball.trail.slice(0, 5) })),
      particles: state.particles.slice(-100)
    };
    const packet = { type: 'state', state: snapshot };
    connections.forEach(entry => {
      if (entry.connection.open) entry.connection.send(packet);
    });
  }

  function getRoomId(code) {
    return `qb-${code.toLowerCase()}`;
  }

  function networkError(error) {
    const type = error && error.type;
    if (type === 'unavailable-id') return 'Esse código de sala já está em uso. Tente criar outra sala.';
    if (type === 'peer-unavailable') return 'Sala não encontrada. Confira o código e tente novamente.';
    if (type === 'browser-incompatible') return 'Este navegador não oferece suporte a conexões WebRTC.';
    return `Falha na conexão${type ? ` (${type})` : ''}. Verifique a rede e tente novamente.`;
  }

  function leave() {
    const activeConnections = Array.from(connections.values());
    const activeHostConnection = hostConnection;
    const activePeer = peer;
    connections.clear();
    hostConnection = null;
    peer = null;
    host = false;
    handlers = {};

    activeConnections.forEach(entry => {
      try { entry.connection.close(); } catch (error) { console.warn('Falha ao fechar uma conexão.', error); }
    });
    if (activeHostConnection) {
      try { activeHostConnection.close(); } catch (error) { console.warn('Falha ao fechar a conexão da sala.', error); }
    }
    if (activePeer && !activePeer.destroyed) {
      try { activePeer.destroy(); } catch (error) { console.warn('Falha ao encerrar o PeerJS.', error); }
    }
  }

  window.QB.Network = Object.freeze({ createHost, joinRoom, sendInput, broadcastState, getRoomId, leave });
})();
