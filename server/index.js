import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server } from 'socket.io';
import { createEngine } from './gameEngine.js';
import { loadState, saveState } from './persistence.js';
import { scanGames, loadGame } from './gameCatalog.js';
import { registerSocketHandlers } from './socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const GAMES_DIR = path.join(ROOT, 'data', 'games');
const STATE_PATH = path.join(ROOT, 'data', 'game-state.json');
const DIST_PATH = path.join(ROOT, 'dist');

const catalog = scanGames(GAMES_DIR);
const savedState = loadState(STATE_PATH);

let initialContent = { title: '', rounds: [] };
if (savedState?.selectedGameId) {
  try {
    initialContent = loadGame(GAMES_DIR, savedState.selectedGameId);
  } catch (err) {
    console.warn('Не удалось загрузить сохранённую игру:', err.message);
    savedState.selectedGameId = null;
    savedState.phase = 'game_select';
  }
}

const engine = createEngine(initialContent, savedState, catalog);

const app = express();
app.use('/games', express.static(GAMES_DIR));
app.use(express.static(DIST_PATH));
app.get(/^(?!\/socket\.io).*/, (req, res) => {
  res.sendFile(path.join(DIST_PATH, 'index.html'), (err) => {
    if (err) {
      res
        .status(404)
        .send('Фронтенд не собран. Выполните: npm run build');
    }
  });
});

const server = http.createServer(app);
const io = new Server(server);

registerSocketHandlers(io, engine, {
  gamesDir: GAMES_DIR,
  persist: () => saveState(STATE_PATH, engine.getState())
});

function lanUrls() {
  const urls = [];
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          urls.push(`http://${net.address}:${PORT}`);
        }
      }
    }
  } catch {
    // Some environments block reading network interfaces; fall back to localhost.
  }
  if (urls.length === 0) urls.push(`http://localhost:${PORT}`);
  return urls;
}

server.listen(PORT, '0.0.0.0', () => {
  const urls = lanUrls();
  console.log('\nСвоя игра запущена!');
  console.log(`Игр в каталоге: ${catalog.length}`);
  console.log('Откройте на устройствах в одной WiFi-сети:\n');
  for (const url of urls) {
    console.log(`  Экран-показ:  ${url}/display`);
    console.log(`  Ведущий:      ${url}/host`);
    console.log(`  Игроки:       ${url}/player\n`);
  }
});
