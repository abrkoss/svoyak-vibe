import { defineStore } from 'pinia';
import { io } from 'socket.io-client';

const STORAGE_KEY = 'svoyak-player-id';

export const useGameStore = defineStore('game', {
  state: () => ({
    socket: null,
    role: null,
    connected: false,
    state: null, // public view
    hostState: null, // full view (host only)
    playerId: localStorage.getItem(STORAGE_KEY) || null,
    joined: false
  }),

  getters: {
    view: (s) => s.hostState || s.state,
    me: (s) => (s.state && s.playerId
      ? s.state.players.find((p) => p.id === s.playerId) || null
      : null)
  },

  actions: {
    connect(role) {
      if (this.socket) return;
      this.role = role;
      const socket = io({ query: { role } });
      this.socket = socket;

      socket.on('connect', () => {
        this.connected = true;
        if (role === 'player' && this.playerId) {
          socket.emit('player:reconnect', { playerId: this.playerId });
        }
      });
      socket.on('disconnect', () => { this.connected = false; });
      socket.on('state', (view) => { this.state = view; });
      socket.on('hostState', (view) => { this.hostState = view; });
      socket.on('player:joined', ({ playerId }) => {
        this.playerId = playerId;
        this.joined = true;
        localStorage.setItem(STORAGE_KEY, playerId);
      });
      socket.on('player:unknown', () => {
        this.playerId = null;
        this.joined = false;
        localStorage.removeItem(STORAGE_KEY);
      });
    },

    // Player actions
    join(name) { this.socket?.emit('player:join', { name }); },
    buzz() { this.socket?.emit('player:buzz'); },
    bet(amount) { this.socket?.emit('player:bet', { amount }); },
    answer(text) { this.socket?.emit('player:answer', { text }); },

    // Host actions
    hostSelect(themeIndex, questionIndex) {
      this.socket?.emit('host:select', { themeIndex, questionIndex });
    },
    hostOpenBuzzer() { this.socket?.emit('host:openBuzzer'); },
    hostJudge(correct) { this.socket?.emit('host:judge', { correct }); },
    hostAdjustScore(playerId, delta) {
      this.socket?.emit('host:adjustScore', { playerId, delta });
    },
    hostBackToBoard() { this.socket?.emit('host:backToBoard'); },
    hostNextRound() { this.socket?.emit('host:nextRound'); },
    hostRemoveTheme(themeIndex) { this.socket?.emit('host:removeTheme', { themeIndex }); },
    hostOpenBets() { this.socket?.emit('host:openBets'); },
    hostRevealFinalQuestion() { this.socket?.emit('host:revealFinalQuestion'); },
    hostOpenAnswers() { this.socket?.emit('host:openAnswers'); },
    hostJudgeFinal(playerId, correct) {
      this.socket?.emit('host:judgeFinal', { playerId, correct });
    },
    hostFinish() { this.socket?.emit('host:finish'); }
  }
});
