// Pure game logic for "Своя игра". No sockets, no I/O.
// createEngine(content) -> engine with action methods + view serializers.

function keyOf(roundIndex, themeIndex, questionIndex) {
  return `${roundIndex}:${themeIndex}:${questionIndex}`;
}

export function createEngine(content, savedState = null) {
  const state = savedState ?? {
    phase: 'lobby',
    currentRoundIndex: 0,
    players: [],
    answered: {}, // { "r:t:q": true }
    current: null, // { themeIndex, questionIndex, buzzerOpen, buzzedPlayerId, excluded: [] }
    final: {
      removedThemes: [],
      bets: {}, // playerId -> number
      answers: {}, // playerId -> string
      judged: {}, // playerId -> boolean
      betsOpen: false,
      revealedQuestion: false,
      answersOpen: false
    }
  };

  const rounds = content.rounds;

  function currentRound() {
    return rounds[state.currentRoundIndex];
  }

  function findPlayer(id) {
    return state.players.find((p) => p.id === id) ?? null;
  }

  function firstRemainingFinalThemeIndex() {
    const round = currentRound();
    if (!round || round.type !== 'final') return -1;
    for (let i = 0; i < round.themes.length; i++) {
      if (!state.final.removedThemes.includes(i)) return i;
    }
    return -1;
  }

  // --- Player management ---
  function addOrReconnectPlayer(id, name) {
    const existing = findPlayer(id);
    if (existing) {
      existing.connected = true;
      if (name) existing.name = name;
      return existing;
    }
    const player = { id, name: name || 'Игрок', score: 0, connected: true };
    state.players.push(player);
    return player;
  }

  function setConnected(id, connected) {
    const p = findPlayer(id);
    if (p) p.connected = connected;
  }

  function adjustScore(playerId, delta) {
    const p = findPlayer(playerId);
    if (p) p.score += delta;
  }

  // --- Normal round flow ---
  function selectQuestion(themeIndex, questionIndex) {
    const round = currentRound();
    if (!round || round.type !== 'normal') return;
    if (state.phase !== 'board' && state.phase !== 'lobby') return;
    const theme = round.themes[themeIndex];
    if (!theme || !theme.questions[questionIndex]) return;
    if (state.answered[keyOf(state.currentRoundIndex, themeIndex, questionIndex)]) return;
    state.current = {
      themeIndex,
      questionIndex,
      buzzerOpen: false,
      buzzedPlayerId: null,
      excluded: []
    };
    state.phase = 'question';
  }

  function openBuzzer() {
    if (state.phase !== 'question' || !state.current) return;
    state.current.buzzerOpen = true;
    state.current.buzzedPlayerId = null;
  }

  function buzz(playerId) {
    if (state.phase !== 'question' || !state.current) return false;
    if (!state.current.buzzerOpen || state.current.buzzedPlayerId) return false;
    if (state.current.excluded.includes(playerId)) return false;
    if (!findPlayer(playerId)) return false;
    state.current.buzzedPlayerId = playerId;
    state.current.buzzerOpen = false;
    state.phase = 'buzzed';
    return true;
  }

  function currentValue() {
    const round = currentRound();
    if (!state.current || !round) return 0;
    const theme = round.themes[state.current.themeIndex];
    return theme?.questions[state.current.questionIndex]?.value ?? 0;
  }

  function judge(correct) {
    if (state.phase !== 'buzzed' || !state.current) return;
    const playerId = state.current.buzzedPlayerId;
    const value = currentValue();
    if (correct) {
      adjustScore(playerId, value);
      consumeQuestion();
    } else {
      adjustScore(playerId, -value);
      state.current.excluded.push(playerId);
      state.current.buzzedPlayerId = null;
      state.current.buzzerOpen = true;
      state.phase = 'question';
    }
  }

  function consumeQuestion() {
    if (!state.current) return;
    state.answered[
      keyOf(state.currentRoundIndex, state.current.themeIndex, state.current.questionIndex)
    ] = true;
    state.current = null;
    state.phase = 'board';
  }

  function backToBoard() {
    // Host skips / closes current question without awarding points.
    if (state.current) consumeQuestion();
    else if (state.phase !== 'final_remove') state.phase = 'board';
  }

  function nextRound() {
    if (state.currentRoundIndex >= rounds.length - 1) return;
    state.currentRoundIndex += 1;
    state.current = null;
    const round = currentRound();
    state.phase = round.type === 'final' ? 'final_remove' : 'board';
  }

  // --- Final round flow ---
  function removeTheme(themeIndex) {
    if (state.phase !== 'final_remove') return;
    const round = currentRound();
    if (!round || round.type !== 'final') return;
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    const remaining = round.themes.length - state.final.removedThemes.length;
    if (remaining <= 1) return; // keep at least one
    if (!state.final.removedThemes.includes(themeIndex)) {
      state.final.removedThemes.push(themeIndex);
    }
  }

  function openBets() {
    if (state.phase !== 'final_remove') return;
    if (firstRemainingFinalThemeIndex() === -1) return;
    state.phase = 'final_bets';
    state.final.betsOpen = true;
  }

  function placeBet(playerId, amount) {
    if (state.phase !== 'final_bets') return;
    const p = findPlayer(playerId);
    if (!p) return;
    const max = Math.max(p.score, 0);
    const clamped = Math.max(0, Math.min(Math.floor(Number(amount) || 0), max));
    state.final.bets[playerId] = clamped;
  }

  function revealFinalQuestion() {
    if (state.phase !== 'final_bets') return;
    state.phase = 'final_answers';
    state.final.betsOpen = false;
    state.final.revealedQuestion = true;
  }

  function submitAnswer(playerId, text) {
    if (state.phase !== 'final_answers') return;
    if (!findPlayer(playerId)) return;
    state.final.answers[playerId] = String(text ?? '').slice(0, 300);
  }

  function openAnswers() {
    if (state.phase !== 'final_answers') return;
    state.phase = 'final_reveal';
    state.final.answersOpen = true;
  }

  function judgeFinal(playerId, correct) {
    if (state.phase !== 'final_reveal') return;
    const p = findPlayer(playerId);
    if (!p) return;
    if (playerId in state.final.judged) return; // already judged once
    const bet = state.final.bets[playerId] ?? 0;
    adjustScore(playerId, correct ? bet : -bet);
    state.final.judged[playerId] = !!correct;
  }

  function finish() {
    state.phase = 'finished';
  }

  // --- Views ---
  function buildBoard() {
    const round = currentRound();
    if (!round || round.type !== 'normal') return null;
    return round.themes.map((theme, themeIndex) => ({
      name: theme.name,
      questions: theme.questions.map((q, questionIndex) => ({
        value: q.value,
        answered: !!state.answered[keyOf(state.currentRoundIndex, themeIndex, questionIndex)]
      }))
    }));
  }

  function currentQuestionMeta(withAnswer) {
    const round = currentRound();
    if (!state.current || !round) return null;
    const theme = round.themes[state.current.themeIndex];
    const q = theme.questions[state.current.questionIndex];
    const meta = {
      themeName: theme.name,
      value: q.value,
      text: q.text,
      buzzerOpen: state.current.buzzerOpen,
      buzzedPlayerId: state.current.buzzedPlayerId,
      excluded: state.current.excluded
    };
    if (withAnswer) meta.answer = q.answer;
    return meta;
  }

  function finalView(withSecrets) {
    const round = currentRound();
    if (!round || round.type !== 'final') return null;
    const remainingIndex = firstRemainingFinalThemeIndex();
    const view = {
      themes: round.themes.map((t, i) => ({
        name: t.name,
        removed: state.final.removedThemes.includes(i)
      })),
      betsOpen: state.final.betsOpen,
      revealedQuestion: state.final.revealedQuestion,
      answersOpen: state.final.answersOpen,
      remainingThemeName: remainingIndex >= 0 ? round.themes[remainingIndex].name : null,
      question: state.final.revealedQuestion && remainingIndex >= 0 ? round.themes[remainingIndex].text : null,
      betPlaced: Object.keys(state.final.bets),
      answered: Object.keys(state.final.answers)
    };
    if (withSecrets) {
      view.answer = remainingIndex >= 0 ? round.themes[remainingIndex].answer : null;
    }
    // Reveal per-player bet/answer when the host opened answers.
    if (withSecrets || state.final.answersOpen) {
      view.reveal = state.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        bet: state.final.bets[p.id] ?? 0,
        answer: state.final.answers[p.id] ?? '',
        judged: p.id in state.final.judged ? state.final.judged[p.id] : null
      }));
      if (!withSecrets) view.answer = remainingIndex >= 0 ? round.themes[remainingIndex].answer : null;
    }
    return view;
  }

  function baseView(withSecrets) {
    const round = currentRound();
    return {
      phase: state.phase,
      title: content.title,
      round: round ? { index: state.currentRoundIndex, name: round.name, type: round.type } : null,
      totalRounds: rounds.length,
      isLastRound: state.currentRoundIndex >= rounds.length - 1,
      players: state.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        connected: p.connected
      })),
      board: buildBoard(),
      current: currentQuestionMeta(withSecrets),
      final: finalView(withSecrets)
    };
  }

  return {
    getState: () => state,
    addOrReconnectPlayer,
    setConnected,
    adjustScore,
    selectQuestion,
    openBuzzer,
    buzz,
    judge,
    backToBoard,
    nextRound,
    removeTheme,
    openBets,
    placeBet,
    revealFinalQuestion,
    submitAnswer,
    openAnswers,
    judgeFinal,
    finish,
    publicView: () => baseView(false),
    hostView: () => baseView(true)
  };
}
