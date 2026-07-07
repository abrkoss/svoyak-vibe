<script setup>
import { ref, computed, onMounted } from 'vue';
import { useGameStore } from '../stores/game.js';
import QuestionMedia from '../components/QuestionMedia.vue';
import CountdownTimer from '../components/CountdownTimer.vue';

const store = useGameStore();
const step = ref(100);

onMounted(() => store.connect('host'));

const view = computed(() => store.hostState);
const phase = computed(() => view.value?.phase);
const current = computed(() => view.value?.current);
const final = computed(() => view.value?.final);
const players = computed(() => view.value?.players || []);
const gameId = computed(() => view.value?.selectedGameId);

function playerName(id) {
  return players.value.find((p) => p.id === id)?.name || 'Игрок';
}
const buzzedName = computed(() =>
  current.value?.buzzedPlayerId ? playerName(current.value.buzzedPlayerId) : null
);
const finalThemesLeft = computed(() =>
  final.value ? final.value.themes.filter((t) => !t.removed).length : 0
);
const allJudged = computed(() =>
  final.value?.reveal?.every((r) => r.judged !== null)
);

function confirmRestart() {
  if (phase.value === 'lobby' || window.confirm('Перезапустить игру? Счёт и прогресс будут сброшены.')) {
    store.hostRestartGame();
  }
}

function confirmExit() {
  if (phase.value === 'lobby' || window.confirm('Выйти к выбору игры? Счёт и прогресс будут сброшены.')) {
    store.hostExitToGameSelect();
  }
}
</script>

<template>
  <div class="host" v-if="view">
    <header class="topbar">
      <div>
        <span v-if="phase === 'game_select'" class="round">Выбор игры</span>
        <template v-else>
          <span class="round">{{ view.round?.name }}</span>
          <span class="muted"> · {{ view.title }}</span>
        </template>
      </div>
      <div class="topbar-actions">
        <button
          v-if="phase !== 'game_select' && !view.isLastRound && (phase === 'board' || phase === 'lobby')"
          @click="store.hostNextRound()"
        >Следующий раунд →</button>
        <template v-if="phase !== 'game_select'">
          <button class="secondary" @click="confirmRestart">Перезапустить</button>
          <button class="secondary" @click="confirmExit">Выйти</button>
        </template>
      </div>
    </header>

    <div class="layout">
      <section class="main">
        <!-- Game selection -->
        <div v-if="phase === 'game_select'" class="game-select">
          <h2>Выберите игру</h2>
          <p v-if="!view.availableGames?.length" class="muted">
            Нет доступных игр. Добавьте папки с game.json в data/games/
          </p>
          <div v-else class="game-grid">
            <button
              v-for="g in view.availableGames"
              :key="g.id"
              class="game-card"
              @click="store.hostSelectGame(g.id)"
            >{{ g.title }}</button>
          </div>
        </div>

        <!-- Board -->
        <div v-else-if="(phase === 'board' || phase === 'lobby') && view.board" class="board">
          <div v-for="(theme, ti) in view.board" :key="ti" class="col">
            <div class="theme">{{ theme.name }}</div>
            <button
              v-for="(q, qi) in theme.questions"
              :key="qi"
              class="cell"
              :class="{ done: q.answered }"
              :disabled="q.answered"
              @click="store.hostSelect(ti, qi)"
            >{{ q.answered ? '' : q.value }}</button>
          </div>
        </div>

        <!-- Question -->
        <div v-else-if="phase === 'question' || phase === 'buzzed'" class="question-view">
          <div class="qmeta">{{ current?.themeName }} — {{ current?.value }}</div>
          <QuestionMedia :media="current?.media" :game-id="gameId" />
          <div v-if="current?.text" class="qtext">{{ current?.text }}</div>
          <div class="answer">Ответ: <b>{{ current?.answer }}</b></div>

          <div v-if="buzzedName" class="buzzed">Нажал первым: <b>{{ buzzedName }}</b></div>

          <div class="timers-row">
            <CountdownTimer
              v-if="phase === 'question' && current?.buzzerOpensAt"
              :deadline="current.buzzerOpensAt"
              label="До кнопок"
            />
            <CountdownTimer
              v-if="phase === 'question' && current?.buzzerDeadline"
              :deadline="current.buzzerDeadline"
              label="На кнопку"
            />
            <CountdownTimer
              v-if="phase === 'buzzed' && current?.answerDeadline"
              :deadline="current.answerDeadline"
              label="На ответ"
            />
          </div>

          <div v-if="current?.answerTimeExpired" class="expired-warning">
            Время на ответ истекло — решите, верный ответ или нет.
          </div>

          <div class="qcontrols">
            <template v-if="phase === 'buzzed'">
              <button class="good" @click="store.hostJudge(true)">Верно (+{{ current?.value }})</button>
              <button class="bad" @click="store.hostJudge(false)">Неверно (−{{ current?.value }})</button>
            </template>

            <button @click="store.hostBackToBoard()">К табло (закрыть вопрос)</button>
          </div>
        </div>

        <!-- Final: remove themes -->
        <div v-else-if="phase === 'final_remove'" class="final-view">
          <h2>Финал — уберите лишние темы</h2>
          <p class="muted">Осталось убрать до одной темы. Сейчас тем: {{ finalThemesLeft }}</p>
          <div class="final-themes">
            <button
              v-for="(t, i) in final.themes"
              :key="i"
              :class="{ removed: t.removed }"
              :disabled="t.removed || finalThemesLeft <= 1"
              @click="store.hostRemoveTheme(i)"
            >{{ t.name }}<span v-if="t.removed"> ✕</span></button>
          </div>
          <button class="primary" :disabled="finalThemesLeft !== 1" @click="store.hostOpenBets()">
            Открыть ставки (тема: {{ final.remainingThemeName }})
          </button>
        </div>

        <!-- Final: bets -->
        <div v-else-if="phase === 'final_bets'" class="final-view">
          <h2>Финал — ставки</h2>
          <p class="muted">Тема: {{ final.remainingThemeName }}</p>
          <ul class="reveal-list">
            <li v-for="r in final.reveal" :key="r.playerId">
              <span>{{ r.name }}</span>
              <span :class="{ ok: final.betPlaced.includes(r.playerId) }">
                {{ final.betPlaced.includes(r.playerId) ? 'ставка: ' + r.bet : 'ждём…' }}
              </span>
            </li>
          </ul>
          <button class="primary" @click="store.hostRevealFinalQuestion()">Показать вопрос →</button>
        </div>

        <!-- Final: answers -->
        <div v-else-if="phase === 'final_answers'" class="final-view">
          <h2>Финал — вопрос</h2>
          <QuestionMedia :media="final?.media" :game-id="gameId" />
          <div v-if="final?.question" class="qtext">{{ final.question }}</div>
          <div class="answer">Ответ: <b>{{ final.answer }}</b></div>
          <ul class="reveal-list">
            <li v-for="r in final.reveal" :key="r.playerId">
              <span>{{ r.name }}</span>
              <span :class="{ ok: final.answered.includes(r.playerId) }">
                {{ final.answered.includes(r.playerId) ? 'ответил ✓' : 'ждём…' }}
              </span>
            </li>
          </ul>
          <button class="primary" @click="store.hostOpenAnswers()">Открыть ответы →</button>
        </div>

        <!-- Final: reveal -->
        <div v-else-if="phase === 'final_reveal'" class="final-view">
          <h2>Финал — проверка</h2>
          <div class="answer">Правильный ответ: <b>{{ final.answer }}</b></div>
          <ul class="reveal-cards">
            <li v-for="r in final.reveal" :key="r.playerId">
              <div class="rc-head">
                <b>{{ r.name }}</b>
                <span class="muted">ставка: {{ r.bet }}</span>
              </div>
              <div class="rc-answer">«{{ r.answer || '—' }}»</div>
              <div class="rc-controls" v-if="r.judged === null">
                <button class="good" @click="store.hostJudgeFinal(r.playerId, true)">Верно</button>
                <button class="bad" @click="store.hostJudgeFinal(r.playerId, false)">Неверно</button>
              </div>
              <div v-else class="rc-verdict" :class="r.judged ? 'g' : 'b'">
                {{ r.judged ? 'Верно' : 'Неверно' }}
              </div>
            </li>
          </ul>
          <button class="primary" :disabled="!allJudged" @click="store.hostFinish()">Завершить игру</button>
        </div>

        <!-- Finished -->
        <div v-else-if="phase === 'finished'" class="final-view">
          <h2>Игра окончена!</h2>
          <button class="secondary" @click="confirmRestart">Перезапустить</button>
          <button class="secondary" @click="confirmExit">Выбрать другую игру</button>
        </div>
      </section>

      <aside class="scores">
        <div class="scores-head">
          <span>Игроки</span>
          <label class="step">шаг
            <input type="number" v-model.number="step" min="1" style="width:70px" />
          </label>
        </div>
        <p v-if="players.length === 0" class="muted">Пока никто не подключился</p>
        <div v-for="p in players" :key="p.id" class="prow">
          <span class="dot" :class="{ off: !p.connected }"></span>
          <span class="pn">{{ p.name }}</span>
          <button
            v-if="phase === 'lobby'"
            class="remove-btn"
            title="Удалить игрока"
            @click="store.hostRemovePlayer(p.id)"
          >✕</button>
          <span class="ps" :class="{ neg: p.score < 0 }">{{ p.score }}</span>
          <span class="adj">
            <button @click="store.hostAdjustScore(p.id, -step)">−</button>
            <button @click="store.hostAdjustScore(p.id, step)">+</button>
          </span>
        </div>
      </aside>
    </div>
  </div>
  <div v-else class="loading">Подключение…</div>
</template>

<style scoped>
.host { min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 1.2rem; background: var(--panel); border-bottom: 2px solid var(--border);
}
.topbar-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.round { font-size: 1.3rem; font-weight: 800; color: var(--accent); }
.muted { color: var(--muted); }
.layout { flex: 1; display: flex; gap: 1rem; padding: 1rem; }
.main { flex: 1; }

.game-select { display: flex; flex-direction: column; gap: 1rem; }
.game-grid { display: flex; gap: 0.8rem; flex-wrap: wrap; }
.game-card {
  padding: 1.5rem 2rem; font-size: 1.2rem; font-weight: 700;
  background: var(--panel-2); border-radius: 12px; min-width: 200px;
}
.game-card:hover { background: var(--accent-2); color: #04283a; }

.board { display: flex; gap: 0.5rem; }
.col { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
.theme {
  background: var(--accent-2); color: #04283a; font-weight: 800;
  padding: 0.7rem; text-align: center; border-radius: 8px; min-height: 3.4rem;
  display: flex; align-items: center; justify-content: center;
}
.cell {
  background: var(--panel-2); color: var(--accent);
  font-size: 1.4rem; font-weight: 800; padding: 1rem; border-radius: 8px;
}
.cell.done { background: var(--panel); color: var(--panel); }

.question-view, .final-view { display: flex; flex-direction: column; gap: 1rem; }
.qmeta { color: var(--accent); font-weight: 700; font-size: 1.1rem; }
.qtext { font-size: 1.8rem; line-height: 1.4; }
.answer { font-size: 1.2rem; color: var(--green); }
.buzzed { font-size: 1.4rem; background: var(--panel-2); padding: 0.8rem; border-radius: 10px; }
.timers-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.expired-warning {
  padding: 0.9rem 1.1rem; border-radius: 10px;
  background: rgba(220, 80, 60, 0.2); border: 2px solid var(--red);
  color: var(--red); font-weight: 700; font-size: 1.1rem;
}
.qcontrols { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.qcontrols button { padding: 1rem 1.4rem; font-size: 1.1rem; }
.secondary { background: var(--panel-2); }

.final-themes { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.final-themes button { padding: 0.9rem 1.2rem; }
.final-themes button.removed { opacity: 0.4; text-decoration: line-through; }

.reveal-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.reveal-list li {
  display: flex; justify-content: space-between; padding: 0.6rem 0.9rem;
  background: var(--panel); border-radius: 8px;
}
.reveal-list .ok { color: var(--green); }
.reveal-cards { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.reveal-cards li { background: var(--panel); border-radius: 10px; padding: 0.8rem 1rem; }
.rc-head { display: flex; justify-content: space-between; }
.rc-answer { font-size: 1.3rem; margin: 0.4rem 0; }
.rc-controls { display: flex; gap: 0.5rem; }
.rc-verdict.g { color: var(--green); font-weight: 700; }
.rc-verdict.b { color: var(--red); font-weight: 700; }

.scores { width: 300px; background: var(--panel); border-radius: 12px; padding: 1rem; }
.scores-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; font-weight: 700; }
.step { font-size: 0.85rem; color: var(--muted); display: flex; gap: 0.3rem; align-items: center; }
.prow { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
.dot.off { background: var(--muted); }
.pn { flex: 1; }
.remove-btn {
  padding: 0.1rem 0.45rem; font-size: 0.85rem; line-height: 1.2;
  background: transparent; color: var(--red); border: 1px solid var(--red);
}
.ps { font-weight: 800; color: var(--accent); min-width: 3rem; text-align: right; }
.ps.neg { color: var(--red); }
.adj button { padding: 0.2rem 0.6rem; margin-left: 0.2rem; }
.loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; color: var(--muted); }
</style>
