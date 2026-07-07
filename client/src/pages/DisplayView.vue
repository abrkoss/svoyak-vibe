<script setup>
import { computed, onMounted } from 'vue';
import { useGameStore } from '../stores/game.js';
import QuestionMedia from '../components/QuestionMedia.vue';
import CountdownTimer from '../components/CountdownTimer.vue';

const store = useGameStore();
onMounted(() => store.connect('display'));

const view = computed(() => store.state);
const phase = computed(() => view.value?.phase);
const current = computed(() => view.value?.current);
const final = computed(() => view.value?.final);
const players = computed(() => view.value?.players || []);

function playerName(id) {
  return players.value.find((p) => p.id === id)?.name || 'Игрок';
}
const buzzedName = computed(() =>
  current.value?.buzzedPlayerId ? playerName(current.value.buzzedPlayerId) : null
);
const sortedPlayers = computed(() =>
  [...players.value].sort((a, b) => b.score - a.score)
);
const assingEmojis = (element) => {
  const topPlayer = sortedPlayers.value[0];
  const worstPlayer = sortedPlayers.value[sortedPlayers.value.length - 1];
  if (element.id === topPlayer.id) {
    return '👑';
  } else if (element.id === worstPlayer.id) {
    return '🤡';
  }
  return '';
};
const gameId = computed(() => view.value?.selectedGameId);
const passLabel = computed(() => {
  if (!current.value?.passed?.length || !['question', 'buzzed'].includes(phase.value)) return null;
  const active = players.value.filter((p) =>
    p.connected && !current.value.excluded.includes(p.id)
  );
  if (active.length === 0) return null;
  return `Пас: ${current.value.passed.length} / ${active.length}`;
});
const passedPlayers = computed(() => {
  if (!current.value?.passed?.length || !['question', 'buzzed'].includes(phase.value)) return [];
  return current.value.passed.map((id) => ({
    id,
    name: playerName(id)
  }));
});
</script>

<template>
  <div class="display" v-if="view">
    <header class="dtop">
      <span class="title">{{ view.title }}</span>
      <span class="round">{{ view.round?.name }}</span>
    </header>

    <main class="dmain">
      <!-- Game selection -->
      <div v-if="phase === 'game_select'" class="wait-big">
        <h1>Ожидание выбора игры</h1>
        <p class="muted">Ведущий выбирает игру…</p>
      </div>

      <!-- Board -->
      <div v-else-if="(phase === 'board' || phase === 'lobby') && view.board" class="board">
        <div v-for="(theme, ti) in view.board" :key="ti" class="col">
          <div class="theme">{{ theme.name }}</div>
          <div
            v-for="(q, qi) in theme.questions"
            :key="qi"
            class="cell"
            :class="{ done: q.answered }"
          >{{ q.value }}</div>
        </div>
      </div>

      <!-- Question (no answer) -->
      <div v-else-if="phase === 'question' || phase === 'buzzed'" class="qbig">
        <div class="qmeta">{{ current?.themeName }} · {{ current?.value }}</div>
        <QuestionMedia :media="current?.media" :game-id="gameId" />
        <div v-if="current?.text" class="qtext">{{ current?.text }}</div>
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
        <div v-if="buzzedName" class="buzz-banner">Отвечает: {{ buzzedName }}</div>
        <div v-else-if="current?.buzzerOpen" class="buzz-open">Кнопки открыты!</div>
        <div v-else-if="phase === 'question' && current?.buzzerOpensAt" class="buzz-wait">Приготовьтесь…</div>
        <div v-if="passLabel" class="pass-info">{{ passLabel }}</div>
        <div v-if="passedPlayers.length" class="pass-chips">
          <div v-for="p in passedPlayers" :key="p.id" class="chip passed">
            {{ p.name }} — пас
          </div>
        </div>
      </div>

      <!-- Final: remove themes -->
      <div v-else-if="phase === 'final_remove'" class="final-big">
        <h1>ФИНАЛ</h1>
        <div class="ftheme-row">
          <div
            v-for="(t, i) in final.themes"
            :key="i"
            class="ftheme"
            :class="{ removed: t.removed }"
          >{{ t.name }}</div>
        </div>
      </div>

      <!-- Final: bets -->
      <div v-else-if="phase === 'final_bets'" class="final-big">
        <h1>Ставки</h1>
        <p class="ftheme-name">{{ final.remainingThemeName }}</p>
        <div class="chips">
          <div v-for="p in players" :key="p.id" class="chip" :class="{ ready: final.betPlaced.includes(p.id) }">
            {{ p.name }}<span v-if="final.betPlaced.includes(p.id)"> ✓</span>
          </div>
        </div>
      </div>

      <!-- Final: answers -->
      <div v-else-if="phase === 'final_answers'" class="final-big">
        <div class="qmeta">Финал · {{ final.remainingThemeName }}</div>
        <QuestionMedia :media="final?.media" :game-id="gameId" />
        <div v-if="final?.question" class="qtext">{{ final.question }}</div>
        <div class="chips">
          <div v-for="p in players" :key="p.id" class="chip" :class="{ ready: final.answered.includes(p.id) }">
            {{ p.name }}<span v-if="final.answered.includes(p.id)"> ✓</span>
          </div>
        </div>
      </div>

      <!-- Final: reveal -->
      <div v-else-if="phase === 'final_reveal'" class="final-big">
        <div class="qmeta">Правильный ответ:</div>
        <div class="qtext accent">{{ final.answer }}</div>
        <div class="reveal-grid">
          <div
            v-for="r in final.reveal"
            :key="r.playerId"
            class="rcard"
            :class="{ g: r.judged === true, b: r.judged === false }"
          >
            <div class="rc-name">{{ r.name }}</div>
            <div class="rc-ans">«{{ r.answer || '—' }}»</div>
            <div class="rc-bet">ставка: {{ r.bet }}</div>
          </div>
        </div>
      </div>

      <!-- Finished -->
      <div v-else-if="phase === 'finished'" class="final-big">
        <h1>🏆 Итоги</h1>
        <ol class="standings">
          <li v-for="p in sortedPlayers" :key="p.id">
            <span>{{ p.name }}</span>
            <span :class="{ neg: p.score < 0 }">{{ p.score }}</span>
          </li>
        </ol>
      </div>
    </main>

    <!-- Scoreboard -->
    <footer class="scorebar">
      <div
        v-for="(p, i) in sortedPlayers"
        :key="p.id"
        class="sp"
        :class="{
          buzz: current?.buzzedPlayerId === p.id,
          passed: current?.passed?.includes(p.id)
        }"
      >
        <span v-if="i === 0 || i === sortedPlayers.length - 1" class="spi">{{ assingEmojis(p) }}</span>
        <span class="spn">{{ p.name }}</span>
        <span v-if="current?.passed?.includes(p.id)" class="sp-pass">пас</span>
        <span class="sps" :class="{ neg: p.score < 0 }">{{ p.score }}</span>
      </div>
    </footer>
  </div>
  <div v-else class="loading">Подключение…</div>
</template>

<style scoped>
.display { min-height: 100vh; display: flex; flex-direction: column; }
.dtop {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 2rem; background: var(--panel); border-bottom: 2px solid var(--border);
}
.title { font-size: 1.6rem; font-weight: 800; }
.round { font-size: 1.6rem; font-weight: 800; color: var(--accent); }
.dmain { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }

.board { display: flex; gap: 0.7rem; width: 100%; max-width: 1400px; }
.col { flex: 1; display: flex; flex-direction: column; gap: 0.7rem; }
.theme {
  background: var(--accent-2); color: #04283a; font-weight: 800;
  padding: 1rem; text-align: center; border-radius: 10px; min-height: 4rem;
  display: flex; align-items: center; justify-content: center; font-size: 1.4rem;
}
.cell {
  background: var(--panel-2); color: var(--accent);
  font-size: 2.6rem; font-weight: 900; padding: 1.4rem; border-radius: 10px;
  text-align: center;
}
.cell.done { background: var(--panel); color: var(--panel-2); }

.qbig { text-align: center; max-width: 1200px; }
.qmeta { font-size: 1.6rem; color: var(--accent); font-weight: 700; margin-bottom: 1.5rem; }
.qtext { font-size: 3.4rem; line-height: 1.3; font-weight: 700; }
.qtext.accent { color: var(--green); }
.buzz-banner { margin-top: 2rem; font-size: 2.4rem; font-weight: 800; color: var(--accent); }
.buzz-open { margin-top: 2rem; font-size: 2rem; color: var(--green); font-weight: 700; }
.buzz-wait { margin-top: 2rem; font-size: 1.8rem; color: var(--muted); font-weight: 600; }
.timers-row { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }
.pass-info { margin-top: 1rem; font-size: 1.6rem; color: var(--muted); }
.pass-chips { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-top: 1.2rem; }
.chip.passed {
  background: var(--panel);
  border: 2px solid var(--muted);
  color: var(--muted);
  font-weight: 700;
  text-decoration: line-through;
}

.final-big { text-align: center; }
.final-big h1 { font-size: 4rem; color: var(--accent); margin: 0 0 1.5rem; }
.ftheme-row { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
.ftheme {
  background: var(--panel-2); padding: 1.5rem 2rem; border-radius: 12px;
  font-size: 2rem; font-weight: 700;
}
.ftheme.removed { opacity: 0.3; text-decoration: line-through; }
.ftheme-name { font-size: 2rem; color: var(--accent); }
.chips { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-top: 2rem; }
.chip { background: var(--panel-2); padding: 1rem 1.5rem; border-radius: 10px; font-size: 1.4rem; }
.chip.ready { background: var(--green); color: #062a12; font-weight: 700; }

.reveal-grid { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-top: 1.5rem; }
.rcard { background: var(--panel-2); border: 3px solid var(--border); padding: 1.2rem; border-radius: 12px; min-width: 200px; }
.rcard.g { border-color: var(--green); }
.rcard.b { border-color: var(--red); }
.rc-name { font-size: 1.4rem; font-weight: 700; }
.rc-ans { font-size: 1.6rem; margin: 0.5rem 0; }
.rc-bet { color: var(--muted); }

.standings { list-style: decimal; font-size: 2rem; text-align: left; display: inline-block; }
.standings li { display: flex; gap: 2rem; justify-content: space-between; padding: 0.4rem 0; min-width: 320px; }

.scorebar {
  display: flex; gap: 0.6rem; padding: 1rem 2rem; background: var(--panel);
  border-top: 2px solid var(--border); overflow-x: auto;
}
.sp {
  position: relative;
  background: var(--panel-2); border-radius: 10px; padding: 0.6rem 1.2rem;
  display: flex; flex-direction: column; align-items: center; min-width: 110px;
}
.sp.buzz { background: var(--accent); color: #1a1a1a; }
.sp.passed { opacity: 0.65; border: 2px dashed var(--muted); }
.spn { font-size: 1.1rem; font-weight: 700; }
.sp-pass { font-size: 0.85rem; color: var(--muted); font-weight: 700; text-transform: uppercase; }
.sps { font-size: 1.6rem; font-weight: 900; color: var(--accent); }
.sp.buzz .sps { color: #1a1a1a; }
.sps.neg { color: var(--red); }
.spi {position: absolute; font-size: 1.5rem; top: -12px; right: -5px; transform: rotate(18deg);}
.neg { color: var(--red); }
.wait-big { text-align: center; }
.wait-big h1 { font-size: 3.5rem; color: var(--accent); margin: 0 0 1rem; }
.wait-big .muted { font-size: 1.8rem; }
.loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 1.5rem; }
</style>
