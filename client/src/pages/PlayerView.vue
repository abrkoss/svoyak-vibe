<script setup>
import { ref, computed, onMounted } from 'vue';
import { useGameStore } from '../stores/game.js';
import CountdownTimer from '../components/CountdownTimer.vue';

const store = useGameStore();
const nameInput = ref('');
const betInput = ref(0);
const answerInput = ref('');

onMounted(() => store.connect('player'));

const view = computed(() => store.state);
const me = computed(() => store.me);
const phase = computed(() => view.value?.phase);
const current = computed(() => view.value?.current);
const final = computed(() => view.value?.final);

// "Joined" means the server knows this player id.
const isJoined = computed(() => !!me.value);

const iAmExcluded = computed(() => current.value?.excluded?.includes(store.playerId));
const iPassed = computed(() => current.value?.passed?.includes(store.playerId));

const canBuzz = computed(() =>
  phase.value === 'question' &&
  current.value?.buzzerOpen &&
  !current.value?.buzzedPlayerId &&
  !iAmExcluded.value &&
  !iPassed.value
);
const canPass = computed(() => canBuzz.value);
const iBuzzed = computed(() => current.value?.buzzedPlayerId === store.playerId);
const buzzedName = computed(() => {
  const id = current.value?.buzzedPlayerId;
  if (!id) return null;
  return view.value?.players.find((p) => p.id === id)?.name || 'Игрок';
});

const myBetPlaced = computed(() => final.value?.betPlaced?.includes(store.playerId));
const myAnswerPlaced = computed(() => final.value?.answered?.includes(store.playerId));
const maxBet = computed(() => Math.max(me.value?.score || 0, 0));

function submitName() {
  const name = nameInput.value.trim();
  if (name) store.join(name);
}
function submitBet() {
  store.bet(betInput.value);
}
function submitAnswer() {
  if (answerInput.value.trim()) store.answer(answerInput.value.trim());
}
</script>

<template>
  <div class="player">
    <!-- Removed by host -->
    <div v-if="store.removed" class="center card">
      <h2>Вас удалили из игры</h2>
      <p class="muted">Введите имя, чтобы войти снова</p>
      <input v-model="nameInput" maxlength="20" placeholder="Имя" @keyup.enter="submitName" />
      <button class="primary" :disabled="!nameInput.trim()" @click="submitName">Войти</button>
    </div>

    <!-- Name entry -->
    <div v-else-if="!isJoined" class="center card">
      <h2>Своя игра</h2>
      <p class="muted">Введите ваше имя</p>
      <input v-model="nameInput" maxlength="20" placeholder="Имя" @keyup.enter="submitName" />
      <button class="primary" :disabled="!nameInput.trim()" @click="submitName">Войти</button>
    </div>

    <template v-else>
      <header class="pheader">
        <span class="pname">{{ me?.name }}</span>
        <span class="pscore" :class="{ neg: (me?.score || 0) < 0 }">{{ me?.score }}</span>
      </header>

      <!-- Waiting for game / question -->
      <div v-if="phase === 'game_select'" class="center">
        <p class="muted big">Ведущий выбирает игру…</p>
      </div>

      <div v-else-if="phase === 'answer_reveal'" class="center">
        <p class="muted big">Смотрите правильный ответ на экране</p>
      </div>

      <div v-else-if="['lobby','board','question','buzzed','answered'].includes(phase)" class="center">
        <template v-if="phase === 'lobby' || phase === 'board'">
          <p class="muted big">Ждём выбора вопроса ведущим…</p>
        </template>

        <template v-else>
          <div v-if="buzzedName" class="banner" :class="{ me: iBuzzed }">
            {{ iBuzzed ? 'Вы отвечаете!' : 'Отвечает: ' + buzzedName }}
          </div>

          <CountdownTimer
            v-if="phase === 'question' && current?.buzzerDeadline"
            :deadline="current.buzzerDeadline"
            label="На кнопку"
          />
          <CountdownTimer
            v-if="iBuzzed && current?.answerDeadline"
            :deadline="current.answerDeadline"
            label="На ответ"
          />

          <button
            class="buzz"
            :class="{ ready: canBuzz }"
            :disabled="!canBuzz || iAmExcluded"
            @click="store.buzz()"
          >
            <span v-if="iAmExcluded">Вы уже отвечали</span>
            <span v-else-if="iPassed">Вы пасуете</span>
            <span v-else-if="canBuzz">ОТВЕТИТЬ</span>
            <span v-else-if="!current?.buzzerOpen && !buzzedName">Приготовьтесь…</span>
            <span v-else>—</span>
          </button>

          <button
            v-if="canPass"
            class="pass-btn"
            @click="store.pass()"
          >Пас</button>
          <p v-else-if="iPassed && phase === 'question'" class="muted">Вы нажали пас</p>
        </template>
      </div>

      <!-- Final: bets -->
      <div v-else-if="phase === 'final_bets'" class="center card">
        <h3>Финал — ставка</h3>
        <p class="muted">Тема: {{ final?.remainingThemeName }}</p>
        <p class="muted">Максимум: {{ maxBet }}</p>
        <input type="number" v-model.number="betInput" :max="maxBet" min="0" />
        <button class="primary" @click="submitBet">
          {{ myBetPlaced ? 'Изменить ставку' : 'Сделать ставку' }}
        </button>
        <p v-if="myBetPlaced" class="ok">Ставка принята ✓</p>
      </div>

      <!-- Final: answers -->
      <div v-else-if="phase === 'final_answers'" class="center card">
        <h3>Финал — ваш ответ</h3>
        <p class="question">{{ final?.question }}</p>
        <input v-model="answerInput" maxlength="200" placeholder="Ваш ответ" @keyup.enter="submitAnswer" />
        <button class="primary" @click="submitAnswer">
          {{ myAnswerPlaced ? 'Изменить ответ' : 'Отправить' }}
        </button>
        <p v-if="myAnswerPlaced" class="ok">Ответ принят ✓</p>
      </div>

      <!-- Final reveal / finished -->
      <div v-else-if="phase === 'final_reveal' || phase === 'finished'" class="center">
        <p class="muted big">{{ phase === 'finished' ? 'Игра окончена!' : 'Смотрите на экран' }}</p>
        <div class="banner">Ваш счёт: {{ me?.score }}</div>
      </div>

      <div v-else-if="phase === 'final_remove'" class="center">
        <p class="muted big">Ведущий выбирает финальную тему…</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.player { min-height: 100vh; display: flex; flex-direction: column; }
.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  text-align: center;
}
.card { gap: 1rem; }
.card input { width: 100%; max-width: 320px; text-align: center; font-size: 1.3rem; }
.card button { width: 100%; max-width: 320px; padding: 1rem; }
.pheader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--panel);
  border-bottom: 2px solid var(--border);
}
.pname { font-size: 1.3rem; font-weight: 700; }
.pscore { font-size: 1.6rem; font-weight: 800; color: var(--accent); }
.pscore.neg { color: var(--red); }
.muted { color: var(--muted); }
.muted.big { font-size: 1.3rem; }
.ok { color: var(--green); font-weight: 700; }
.question { font-size: 1.4rem; line-height: 1.4; }
.banner {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  background: var(--panel-2);
  font-size: 1.4rem;
  font-weight: 700;
}
.banner.me { background: var(--green); color: #062a12; }
.buzz {
  width: min(80vw, 320px);
  height: min(80vw, 320px);
  border-radius: 50%;
  font-size: 2rem;
  font-weight: 900;
  background: var(--panel-2);
  color: var(--muted);
  box-shadow: 0 8px 0 rgba(0,0,0,0.3);
}
.buzz.ready {
  background: var(--red);
  color: #fff;
  animation: pulse 1s infinite;
}
.pass-btn {
  width: min(80vw, 320px);
  padding: 0.9rem 1.5rem;
  font-size: 1.2rem;
  font-weight: 700;
  background: var(--panel);
  border: 2px solid var(--muted);
  color: var(--muted);
  border-radius: 12px;
}
.pass-btn:hover { border-color: var(--accent); color: var(--accent); }
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
</style>
