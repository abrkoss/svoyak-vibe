import fs from 'fs';
import path from 'path';
import { loadContent } from './persistence.js';

export function scanGames(gamesDir) {
  let entries;
  try {
    entries = fs.readdirSync(gamesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const games = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const gamePath = path.join(gamesDir, entry.name, 'game.json');
    try {
      const content = loadContent(gamePath);
      games.push({ id: entry.name, title: content.title || entry.name });
    } catch {
      // Skip invalid game folders.
    }
  }
  return games.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

export function loadGame(gamesDir, gameId) {
  if (!gameId || /[/\\]/.test(gameId)) {
    throw new Error(`Некорректный id игры: ${gameId}`);
  }
  const gamePath = path.join(gamesDir, gameId, 'game.json');
  return loadContent(gamePath);
}
