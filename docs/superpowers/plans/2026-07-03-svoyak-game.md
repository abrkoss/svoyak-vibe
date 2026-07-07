# «Своя игра» (local WiFi) Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. No tests per user request — each task: write files → run/verify → commit.

**Goal:** Build a local-WiFi "Своя игра" web app with three screens (display, host, player), multiple rounds, themes, questions, and a final round with theme removal and hidden bets.

**Architecture:** One Node.js server (Express + Socket.IO) serves the built Vue 3 SPA and handles realtime. Pure `gameEngine.js` holds all game logic; `socketHandlers.js` is a thin adapter. Content loaded from `data/questions.json`; state autosaved to `data/game-state.json`.

**Tech Stack:** Node.js, Express, Socket.IO, Vue 3, Vue Router, Pinia, Vite.

---

## Socket event contract (shared source of truth)

**Client → Server:**
- `player:join { name }` → server assigns/reuses `playerId`, replies `player:joined { playerId }`
- `player:reconnect { playerId }`
- `player:buzz {}`
- `player:bet { amount }`
- `player:answer { text }`
- `host:select { themeIndex, questionIndex }`
- `host:openBuzzer {}`
- `host:judge { correct }`
- `host:adjustScore { playerId, delta }`
- `host:backToBoard {}`
- `host:nextRound {}`
- `host:removeTheme { themeIndex }`
- `host:openBets {}`
- `host:revealFinalQuestion {}`
- `host:openAnswers {}`
- `host:judgeFinal { playerId, correct }`
- `host:finish {}`

**Server → Client:**
- `state` → public view (to display + players): no correct answers, bets/answers hidden until revealed
- `hostState` → full view (to host socket room only): includes current answer, bets, answers
- `player:joined { playerId }`
- `error { message }`

Roles determined by the page: `/host` joins `host` room; `/display` joins `display` room; `/player` is a player.

---

## Task 1: Root project scaffolding

**Files:**
- Create: `package.json`
- Create: `README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "svoyak-game",
  "version": "1.0.0",
  "description": "Local WiFi Svoyak (Jeopardy-style) game",
  "type": "module",
  "scripts": {
    "dev:server": "node --watch server/index.js",
    "dev:client": "vite --config client/vite.config.js",
    "dev": "concurrently -k \"npm:dev:server\" \"npm:dev:client\"",
    "build": "vite build --config client/vite.config.js",
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "concurrently": "^8.2.2",
    "pinia": "^2.1.7",
    "socket.io-client": "^4.7.5",
    "vite": "^5.2.0",
    "vue": "^3.4.21",
    "vue-router": "^4.3.0"
  }
}
```

- [ ] **Step 2: Create `README.md`** with run instructions (dev + prod, how to edit `data/questions.json`, how players connect via LAN URL).

- [ ] **Step 3: Install & commit**

```bash
npm install
git add -A && git commit -m "chore: scaffold svoyak project (package.json, README)"
```

---

## Task 2: Content data

**Files:**
- Create: `data/questions.example.json`
- Create: `data/questions.json` (copy of example, real content editable)

- [ ] **Step 1:** Write `data/questions.example.json` with a full demo pack: 2 normal rounds (3 themes × 5 questions each, values 100–500) and 1 final round with 3 themes (one question each). Shape:

```json
{
  "title": "Демо: Своя игра",
  "rounds": [
    { "name": "Раунд 1", "type": "normal",
      "themes": [
        { "name": "История", "questions": [
          { "value": 100, "text": "...", "answer": "..." }
        ] }
      ] },
    { "name": "Финал", "type": "final",
      "themes": [ { "name": "Космос", "text": "...", "answer": "..." } ] }
  ]
}
```

- [ ] **Step 2:** Copy to `data/questions.json`.
- [ ] **Step 3:** Commit.

---

## Task 3: Game engine (pure logic)

**Files:**
- Create: `server/gameEngine.js`

Responsibilities: hold all mutable state; expose action methods and two view serializers (`publicView`, `hostView`). No I/O, no sockets.

- [ ] **Step 1:** Implement `createEngine(content)` returning an object with:
  - state fields: `players[]`, `phase`, `currentRoundIndex`, `answered` (Set per round), `current` (`{themeIndex,questionIndex,buzzerOpen,buzzedPlayerId,excluded[]}`), `final` (`{removedThemes[],bets{},answers{},judged{},revealedQuestion,betsClosed}`)
  - player methods: `addOrReconnectPlayer(id,name)`, `setConnected(id,bool)`
  - board methods: `selectQuestion(t,q)`, `openBuzzer()`, `buzz(playerId)→bool`, `judge(correct)`, `backToBoard()`, `nextRound()`
  - final methods: `removeTheme(t)`, `openBets()`, `placeBet(playerId,amount)`, `revealFinalQuestion()`, `openAnswers()`, `submitAnswer(playerId,text)`, `judgeFinal(playerId,correct)`, `finish()`
  - views: `publicView()`, `hostView()`
- [ ] **Step 2:** Encode phase rules from spec (§ Поток одного вопроса / Поток финала). Buzzer atomic: `buzz` succeeds only if `phase==='question' && current.buzzerOpen && !current.buzzedPlayerId && !current.excluded.includes(playerId)`.
- [ ] **Step 3:** `publicView` omits `answer` of current question, hides final bets/answers unless revealed; `hostView` includes everything.
- [ ] **Step 4:** Quick sanity run:

```bash
node -e "import('./server/gameEngine.js').then(m=>{const e=m.createEngine({title:'t',rounds:[{name:'R1',type:'normal',themes:[{name:'A',questions:[{value:100,text:'q',answer:'a'}]}]}]});e.addOrReconnectPlayer('p1','Alice');e.selectQuestion(0,0);e.openBuzzer();console.log('buzz',e.buzz('p1'));e.judge(true);console.log(JSON.stringify(e.publicView().players));})"
```
Expected: `buzz true` and Alice score `100`.

- [ ] **Step 5:** Commit.

---

## Task 4: Persistence

**Files:**
- Create: `server/persistence.js`

- [ ] **Step 1:** `loadContent(path)` reads & parses `data/questions.json` (throws clear error if missing/invalid).
- [ ] **Step 2:** `loadState(path)` returns saved engine state or `null`; `saveState(path, state)` writes JSON (debounced/synchronous is fine). Serialize `Set` (`answered`) as arrays.
- [ ] **Step 3:** Commit.

---

## Task 5: Server (Express + Socket.IO)

**Files:**
- Create: `server/index.js`
- Create: `server/socketHandlers.js`

- [ ] **Step 1:** `server/index.js`: create Express app, serve `dist/` static (built client) + SPA fallback to `index.html`, create HTTP server + Socket.IO, load content, restore state, wire `registerSocketHandlers(io, engine, save)`. Bind `0.0.0.0`, print all LAN IPv4 URLs (via `os.networkInterfaces()`), port `3000` (env `PORT`).
- [ ] **Step 2:** `server/socketHandlers.js`: map every event in the contract to engine calls. After each mutation: `save()` then broadcast `io.to('display').emit('state', engine.publicView())`, `io.emit` public to players, and `io.to('host').emit('hostState', engine.hostView())`. Handle role rooms on `connection` via `socket.handshake.query.role`. Handle disconnect → `setConnected(false)`.
- [ ] **Step 3:** Run `PORT=3000 npm start` (will serve without dist yet—verify it boots & prints LAN URL, then Ctrl-C).
- [ ] **Step 4:** Commit.

---

## Task 6: Client scaffolding

**Files:**
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/src/main.js`
- Create: `client/src/router.js`
- Create: `client/src/stores/game.js`
- Create: `client/src/App.vue`
- Create: `client/src/style.css`

- [ ] **Step 1:** `vite.config.js`: root `client/`, `@vitejs/plugin-vue`, `build.outDir: '../dist'`, dev `server.proxy` for `/socket.io` → `http://localhost:3000`.
- [ ] **Step 2:** `router.js`: routes `/` (role picker), `/display`, `/host`, `/player`.
- [ ] **Step 3:** `stores/game.js` (Pinia): connect socket.io-client with `query.role`, hold reactive `state`/`hostState`, expose action wrappers that `emit` contract events, persist `playerId` in `localStorage` and auto-reconnect.
- [ ] **Step 4:** `App.vue` `<router-view>`, base `style.css` (dark themed, large fonts).
- [ ] **Step 5:** Commit.

---

## Task 7: Player screen

**Files:**
- Create: `client/src/pages/PlayerView.vue`

- [ ] **Step 1:** Name entry → join; lobby waiting state; big "Ответить" buzz button (enabled only when `state.current.buzzerOpen && !buzzedPlayerId`); shows own score and whether they won the buzz.
- [ ] **Step 2:** Final: hidden bet input (`final_bets`), text answer input (`final_answers`), waiting states otherwise.
- [ ] **Step 3:** Commit.

---

## Task 8: Host screen

**Files:**
- Create: `client/src/pages/HostView.vue`

- [ ] **Step 1:** Clickable board (themes×values), answered cells disabled; on select show question + **answer**; "Открыть кнопки"; show buzzed player; "Верно"/"Неверно"; per-player +/− score adjust; "Следующий раунд".
- [ ] **Step 2:** Final controls: remove-theme buttons (until 1 left), "Открыть ставки", reveal question, "Открыть ответы", per-player reveal of bet+answer with Верно/Неверно, "Завершить игру".
- [ ] **Step 3:** Commit.

---

## Task 9: Display screen

**Files:**
- Create: `client/src/pages/DisplayView.vue`

- [ ] **Step 1:** Board with dimming of answered cells; large current question (no answer); buzzed-player banner; scoreboard.
- [ ] **Step 2:** Final: theme removal view, "ставки сделаны" (hidden values), reveal answers one-by-one, final standings on `finished`.
- [ ] **Step 3:** Commit.

---

## Task 10: Build & end-to-end verification

- [ ] **Step 1:** `npm run build` → produces `dist/`.
- [ ] **Step 2:** `npm start`, open `/display`, `/host`, `/player` in browsers; verify: join, select question, buzzer race lock, scoring ±, next round, final theme removal, bets, text answers, final scoring.
- [ ] **Step 3:** Commit any fixes + final `README` polish.

---

## Self-Review

- **Spec coverage:** 3 screens (T7–9), rounds+themes+questions (T2,3), host selects question (T8), buzzer race lock (T3,7), classic scoring ± + manual adjust (T3,8), final theme removal + hidden bets + text answers (T3,8,9), JSON content (T2,4), LAN serving (T5), reconnection via localStorage (T6). All covered.
- **Placeholders:** none — each task names exact files and behaviors; engine contract fixed above.
- **Type consistency:** socket event names and engine method names are defined once in the contract/Task 3 and reused.
