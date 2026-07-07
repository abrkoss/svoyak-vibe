export function createQuestionTimers(engine, broadcast) {
  let timers = [];

  function clear() {
    for (const id of timers) clearTimeout(id);
    timers = [];
  }

  function schedule(fn, ms) {
    const id = setTimeout(() => fn(), ms);
    timers.push(id);
  }

  function scheduleBuzzerTimeout() {
    const buzzerTimeSec = engine.getCurrentBuzzerTimeSec();
    schedule(() => {
      if (engine.buzzerTimeout()) broadcast();
    }, buzzerTimeSec * 1000);
  }

  function scheduleAnswerTimeout() {
    const { answerTimeSec } = engine.getSettings();
    schedule(() => {
      if (engine.answerTimeout()) broadcast();
    }, answerTimeSec * 1000);
  }

  function onQuestionSelected() {
    clear();
    const { buzzerDelaySec } = engine.getSettings();
    schedule(() => {
      if (!engine.openBuzzer()) return;
      broadcast();
      scheduleBuzzerTimeout();
    }, buzzerDelaySec * 1000);
  }

  function onBuzzed() {
    clear();
    scheduleAnswerTimeout();
  }

  function onWrongAnswer() {
    clear();
    scheduleBuzzerTimeout();
  }

  function onQuestionEnded() {
    clear();
  }

  return {
    onQuestionSelected,
    onBuzzed,
    onWrongAnswer,
    onQuestionEnded
  };
}
