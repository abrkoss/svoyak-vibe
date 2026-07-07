import crypto from 'crypto';

export function registerSocketHandlers(io, engine, persist) {
  function broadcast() {
    persist();
    io.emit('state', engine.publicView());
    io.to('host').emit('hostState', engine.hostView());
  }

  io.on('connection', (socket) => {
    const role = socket.handshake.query.role;
    if (role === 'host') socket.join('host');
    if (role === 'display') socket.join('display');

    // Send current snapshot immediately on connect.
    socket.emit('state', engine.publicView());
    if (role === 'host') socket.emit('hostState', engine.hostView());

    // --- Player events ---
    socket.on('player:join', ({ name } = {}) => {
      const id = crypto.randomUUID();
      socket.data.playerId = id;
      engine.addOrReconnectPlayer(id, name);
      socket.emit('player:joined', { playerId: id });
      broadcast();
    });

    socket.on('player:reconnect', ({ playerId } = {}) => {
      if (!playerId) return;
      socket.data.playerId = playerId;
      const p = engine.getState().players.find((x) => x.id === playerId);
      if (p) {
        engine.setConnected(playerId, true);
        socket.emit('player:joined', { playerId });
        broadcast();
      } else {
        // Unknown id (e.g. state was reset) — ask client to re-enter name.
        socket.emit('player:unknown');
      }
    });

    socket.on('player:buzz', () => {
      const id = socket.data.playerId;
      if (!id) return;
      if (engine.buzz(id)) broadcast();
    });

    socket.on('player:bet', ({ amount } = {}) => {
      const id = socket.data.playerId;
      if (!id) return;
      engine.placeBet(id, amount);
      broadcast();
    });

    socket.on('player:answer', ({ text } = {}) => {
      const id = socket.data.playerId;
      if (!id) return;
      engine.submitAnswer(id, text);
      broadcast();
    });

    // --- Host events ---
    const hostOnly = (fn) => (payload) => {
      if (role !== 'host') return;
      fn(payload || {});
      broadcast();
    };

    socket.on('host:select', hostOnly(({ themeIndex, questionIndex }) =>
      engine.selectQuestion(themeIndex, questionIndex)));
    socket.on('host:openBuzzer', hostOnly(() => engine.openBuzzer()));
    socket.on('host:judge', hostOnly(({ correct }) => engine.judge(correct)));
    socket.on('host:adjustScore', hostOnly(({ playerId, delta }) =>
      engine.adjustScore(playerId, delta)));
    socket.on('host:backToBoard', hostOnly(() => engine.backToBoard()));
    socket.on('host:nextRound', hostOnly(() => engine.nextRound()));
    socket.on('host:removeTheme', hostOnly(({ themeIndex }) => engine.removeTheme(themeIndex)));
    socket.on('host:openBets', hostOnly(() => engine.openBets()));
    socket.on('host:revealFinalQuestion', hostOnly(() => engine.revealFinalQuestion()));
    socket.on('host:openAnswers', hostOnly(() => engine.openAnswers()));
    socket.on('host:judgeFinal', hostOnly(({ playerId, correct }) =>
      engine.judgeFinal(playerId, correct)));
    socket.on('host:finish', hostOnly(() => engine.finish()));

    socket.on('disconnect', () => {
      const id = socket.data.playerId;
      if (id) {
        engine.setConnected(id, false);
        broadcast();
      }
    });
  });
}
