// Pure game logic for "Своя игра". No sockets, no I/O.
// createEngine(content) -> engine with action methods + view serializers.

const EMPTY_CONTENT = { title: '', rounds: [] };

function keyOf(roundIndex, themeIndex, questionIndex) {
  return `${roundIndex}:${themeIndex}:${questionIndex}`;
}

function freshFinal() {
  return {
    removedThemes: [],
    bets: {},
    answers: {},
    judged: {},
    betsOpen: false,
    revealedQuestion: false,
    answersOpen: false
  };
}

function extractMedia(source) {
  if (!source?.media) return null;
  const media = {};
  if (source.media.image) media.image = source.media.image;
  if (source.media.audio) media.audio = source.media.audio;
  if (source.media.video) media.video = source.media.video;
  return Object.keys(media).length ? media : null;
}

function extractAnswerMedia(source) {
  if (!source?.answerMedia) return null;
  const media = {};
  if (source.answerMedia.image) media.image = source.answerMedia.image;
  if (source.answerMedia.audio) media.audio = source.answerMedia.audio;
  if (source.answerMedia.video) media.video = source.answerMedia.video;
  return Object.keys(media).length ? media : null;
}

const DEFAULT_SETTINGS = {
  buzzerDelaySec: 1,
  buzzerTimeSec: 30,
  answerTimeSec: 30
};

function resolveSettings(content) {
  const s = content?.settings ?? {};
  return {
    buzzerDelaySec: Number(s.buzzerDelaySec) > 0 ? Number(s.buzzerDelaySec) : DEFAULT_SETTINGS.buzzerDelaySec,
    buzzerTimeSec: Number(s.buzzerTimeSec) > 0 ? Number(s.buzzerTimeSec) : DEFAULT_SETTINGS.buzzerTimeSec,
    answerTimeSec: Number(s.answerTimeSec) > 0 ? Number(s.answerTimeSec) : DEFAULT_SETTINGS.answerTimeSec
  };
}

export function createEngine(initialContent, savedState = null, initialGames = []) {
  let content = initialContent ?? EMPTY_CONTENT;
  let rounds = content.rounds ?? [];
  let availableGames = initialGames;

  const state = savedState ?? {
    phase: 'game_select',
    selectedGameId: null,
    currentRoundIndex: 0,
    players: [],
    answered: {},
    current: null,
    final: freshFinal()
  };

  if (state.selectedGameId == null && state.phase !== 'game_select') {
    state.phase = 'game_select';
    state.currentRoundIndex = 0;
    state.answered = {};
    state.current = null;
    state.final = freshFinal();
  }

  function setContent(newContent) {
    content = newContent ?? EMPTY_CONTENT;
    rounds = content.rounds ?? [];
  }

  function setAvailableGames(games) {
    availableGames = games;
  }

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

  function resetProgress() {
    state.currentRoundIndex = 0;
    state.answered = {};
    state.current = null;
    state.final = freshFinal();
    for (const p of state.players) {
      p.score = 0;
    }
    state.phase = state.selectedGameId ? 'lobby' : 'game_select';
  }

  // --- Game management ---
  function selectGame(gameId, newContent) {
    if (state.phase !== 'game_select') return false;
    if (!gameId || !newContent) return false;
    state.selectedGameId = gameId;
    setContent(newContent);
    resetProgress();
    state.phase = 'lobby';
    return true;
  }

  function restartGame() {
    if (!state.selectedGameId) return false;
    resetProgress();
    return true;
  }

  function exitToGameSelect() {
    state.selectedGameId = null;
    setContent(EMPTY_CONTENT);
    resetProgress();
    return true;
  }

  function removePlayer(playerId) {
    if (state.phase !== 'lobby') return false;
    const idx = state.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return false;
    state.players.splice(idx, 1);
    return true;
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

  function getSettings() {
    return resolveSettings(content);
  }

  function freshCurrent(themeIndex, questionIndex) {
    const settings = getSettings();
    return {
      themeIndex,
      questionIndex,
      buzzerOpen: false,
      buzzedPlayerId: null,
      excluded: [],
      buzzerOpensAt: Date.now() + settings.buzzerDelaySec * 1000,
      buzzerDeadline: null,
      answerDeadline: null,
      answerTimeExpired: false,
      answerRevealed: false,
      correctJudged: false,
      closeReason: null,
      passed: []
    };
  }

  function getBuzzerTimeSecForQuestion(themeIndex, questionIndex) {
    const round = currentRound();
    const q = round?.themes[themeIndex]?.questions[questionIndex];
    if (q && Number(q.buzzerTimeSec) > 0) return Number(q.buzzerTimeSec);
    return getSettings().buzzerTimeSec;
  }

  function getCurrentBuzzerTimeSec() {
    if (!state.current) return getSettings().buzzerTimeSec;
    return getBuzzerTimeSecForQuestion(state.current.themeIndex, state.current.questionIndex);
  }

  function selectQuestion(themeIndex, questionIndex) {
    const round = currentRound();
    if (!round || round.type !== 'normal') return;
    if (state.phase !== 'board' && state.phase !== 'lobby') return;
    const theme = round.themes[themeIndex];
    if (!theme || !theme.questions[questionIndex]) return;
    if (state.answered[keyOf(state.currentRoundIndex, themeIndex, questionIndex)]) return;
    state.current = freshCurrent(themeIndex, questionIndex);
    state.phase = 'question';
  }

  function openBuzzer() {
    if (state.phase !== 'question' || !state.current) return false;
    state.current.buzzerOpen = true;
    state.current.buzzerOpensAt = null;
    const buzzerTimeSec = getCurrentBuzzerTimeSec();
    state.current.buzzerDeadline = Date.now() + buzzerTimeSec * 1000;
    return true;
  }

  function canStillBuzzOrPass() {
    if (!state.current) return false;
    return state.players.some((p) =>
      p.connected &&
      !state.current.excluded.includes(p.id) &&
      !state.current.passed.includes(p.id)
    );
  }

  function pass(playerId) {
    if (state.phase !== 'question' || !state.current) return false;
    if (!state.current.buzzerOpen || state.current.buzzedPlayerId) return false;
    if (!findPlayer(playerId)) return false;
    if (state.current.excluded.includes(playerId)) return false;
    if (state.current.passed.includes(playerId)) return false;

    state.current.passed.push(playerId);

    if (!canStillBuzzOrPass()) {
      revealAnswer('all_passed');
    }
    return true;
  }

  function buzz(playerId) {
    if (state.phase !== 'question' || !state.current) return false;
    if (!state.current.buzzerOpen || state.current.buzzedPlayerId) return false;
    if (state.current.excluded.includes(playerId)) return false;
    if (state.current.passed.includes(playerId)) return false;
    if (!findPlayer(playerId)) return false;
    state.current.buzzedPlayerId = playerId;
    state.current.buzzerOpen = false;
    state.current.buzzerDeadline = null;
    state.current.answerTimeExpired = false;
    const settings = getSettings();
    state.current.answerDeadline = Date.now() + settings.answerTimeSec * 1000;
    state.phase = 'buzzed';
    return true;
  }

  function buzzerTimeout() {
    if (state.phase !== 'question' || !state.current || !state.current.buzzerOpen) return false;
    revealAnswer('buzzer_timeout');
    return true;
  }

  function answerTimeout() {
    if (state.phase !== 'buzzed' || !state.current || state.current.answerTimeExpired) return false;
    state.current.answerTimeExpired = true;
    return true;
  }

  function revealAnswer(reason) {
    if (!state.current) return;
    state.phase = 'answer_reveal';
    state.current.answerRevealed = true;
    state.current.closeReason = reason;
    state.current.answerDeadline = null;
    state.current.buzzerDeadline = null;
    state.current.buzzerOpen = false;
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
      state.current.correctJudged = true;
      revealAnswer('correct');
    } else {
      adjustScore(playerId, -value);
      state.current.excluded.push(playerId);
      state.current.buzzedPlayerId = null;
      state.current.answerDeadline = null;
      state.current.answerTimeExpired = false;
      state.current.answerRevealed = false;
      state.current.correctJudged = false;
      state.current.closeReason = null;
      state.phase = 'question';
      openBuzzer();
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
    if (remaining <= 1) return;
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
    if (playerId in state.final.judged) return;
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
      text: q.text ?? '',
      media: extractMedia(q),
      buzzerOpen: state.current.buzzerOpen,
      buzzedPlayerId: state.current.buzzedPlayerId,
      excluded: state.current.excluded,
      passed: state.current.passed,
      buzzerTimeSec: getCurrentBuzzerTimeSec(),
      buzzerOpensAt: state.current.buzzerOpensAt,
      buzzerDeadline: state.current.buzzerDeadline,
      answerDeadline: state.current.answerDeadline,
      answerTimeExpired: state.current.answerTimeExpired,
      answerRevealed: state.current.answerRevealed,
      correctJudged: state.current.correctJudged,
      closeReason: state.current.closeReason
    };
    if (withAnswer || state.phase === 'answer_reveal') {
      meta.answer = q.answer;
      meta.answerMedia = extractAnswerMedia(q);
    }
    return meta;
  }

  function finalView(withSecrets) {
    const round = currentRound();
    if (!round || round.type !== 'final') return null;
    const remainingIndex = firstRemainingFinalThemeIndex();
    const remainingTheme = remainingIndex >= 0 ? round.themes[remainingIndex] : null;
    const view = {
      themes: round.themes.map((t, i) => ({
        name: t.name,
        removed: state.final.removedThemes.includes(i)
      })),
      betsOpen: state.final.betsOpen,
      revealedQuestion: state.final.revealedQuestion,
      answersOpen: state.final.answersOpen,
      remainingThemeName: remainingTheme?.name ?? null,
      question: state.final.revealedQuestion && remainingTheme ? remainingTheme.text ?? '' : null,
      media: state.final.revealedQuestion && remainingTheme ? extractMedia(remainingTheme) : null,
      betPlaced: Object.keys(state.final.bets),
      answered: Object.keys(state.final.answers)
    };
    if (withSecrets) {
      view.answer = remainingTheme?.answer ?? null;
    }
    if (withSecrets || state.final.answersOpen) {
      view.reveal = state.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        bet: state.final.bets[p.id] ?? 0,
        answer: state.final.answers[p.id] ?? '',
        judged: p.id in state.final.judged ? state.final.judged[p.id] : null
      }));
      if (!withSecrets) view.answer = remainingTheme?.answer ?? null;
    }
    return view;
  }

  function baseView(withSecrets) {
    const round = currentRound();
    return {
      phase: state.phase,
      selectedGameId: state.selectedGameId,
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
      final: finalView(withSecrets),
      settings: state.selectedGameId ? getSettings() : null
    };
  }

  return {
    getState: () => state,
    setAvailableGames,
    addOrReconnectPlayer,
    setConnected,
    adjustScore,
    selectGame,
    restartGame,
    exitToGameSelect,
    removePlayer,
    getSettings,
    getCurrentBuzzerTimeSec,
    selectQuestion,
    openBuzzer,
    buzz,
    pass,
    buzzerTimeout,
    answerTimeout,
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
    hostView: () => ({ ...baseView(true), availableGames })
  };
}
