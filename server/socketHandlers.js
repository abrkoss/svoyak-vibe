import crypto from 'crypto';
import { loadGame, scanGames } from './gameCatalog.js';
import { createQuestionTimers } from './questionTimers.js';

function emitToPlayer(io, playerId, event, payload) {
  for (const [, socket] of io.sockets.sockets) {
    if (socket.data.playerId === playerId) {
      socket.emit(event, payload);
      break;
    }
  }
}

export function registerSocketHandlers(io, engine, { gamesDir, persist }) {
  function broadcast() {
    persist();
    io.emit('state', engine.publicView());
    io.to('host').emit('hostState', engine.hostView());
  }

  const timers = createQuestionTimers(engine, broadcast);

  io.on('connection', (socket) => {
    const role = socket.handshake.query.role;
    if (role === 'host') socket.join('host');
    if (role === 'display') socket.join('display');

    socket.emit('state', engine.publicView());
    if (role === 'host') socket.emit('hostState', engine.hostView());

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
        socket.emit('player:unknown');
      }
    });

    socket.on('player:buzz', () => {
      const id = socket.data.playerId;
      if (!id) return;
      if (engine.buzz(id)) {
        timers.onBuzzed();
        broadcast();
      }
    });

    socket.on('player:pass', () => {
      const id = socket.data.playerId;
      if (!id) return;
      if (!engine.pass(id)) return;
      if (engine.getState().phase === 'board') {
        timers.onQuestionEnded();
      }
      broadcast();
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

    const hostOnly = (fn) => (payload) => {
      if (role !== 'host') return;
      fn(payload || {});
      broadcast();
    };

    socket.on('host:selectGame', hostOnly(({ gameId } = {}) => {
      timers.onQuestionEnded();
      try {
        const content = loadGame(gamesDir, gameId);
        engine.selectGame(gameId, content);
        engine.setAvailableGames(scanGames(gamesDir));
      } catch (err) {
        console.error('host:selectGame:', err.message);
      }
    }));

    socket.on('host:restartGame', hostOnly(() => {
      timers.onQuestionEnded();
      engine.restartGame();
    }));

    socket.on('host:exitToGameSelect', hostOnly(() => {
      timers.onQuestionEnded();
      engine.exitToGameSelect();
    }));

    socket.on('host:removePlayer', hostOnly(({ playerId } = {}) => {
      if (!playerId) return;
      if (engine.removePlayer(playerId)) {
        emitToPlayer(io, playerId, 'player:removed');
      }
    }));

    socket.on('host:select', (payload) => {
      if (role !== 'host') return;
      const { themeIndex, questionIndex } = payload || {};
      timers.onQuestionEnded();
      engine.selectQuestion(themeIndex, questionIndex);
      if (engine.getState().phase === 'question') {
        timers.onQuestionSelected();
      }
      broadcast();
    });

    socket.on('host:judge', (payload) => {
      if (role !== 'host') return;
      const wasBuzzed = engine.getState().phase === 'buzzed';
      engine.judge(payload?.correct);
      if (wasBuzzed && engine.getState().phase === 'question') {
        timers.onWrongAnswer();
      } else {
        timers.onQuestionEnded();
      }
      broadcast();
    });

    socket.on('host:adjustScore', hostOnly(({ playerId, delta }) =>
      engine.adjustScore(playerId, delta)));
    socket.on('host:backToBoard', hostOnly(() => {
      timers.onQuestionEnded();
      engine.backToBoard();
    }));
    socket.on('host:nextRound', hostOnly(() => {
      timers.onQuestionEnded();
      engine.nextRound();
    }));
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
