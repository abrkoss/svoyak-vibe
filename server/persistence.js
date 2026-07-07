import fs from 'fs';
import path from 'path';

export function loadContent(contentPath) {
  let raw;
  try {
    raw = fs.readFileSync(contentPath, 'utf-8');
  } catch (err) {
    throw new Error(`Не удалось прочитать файл вопросов: ${contentPath}\n${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Файл вопросов содержит некорректный JSON: ${contentPath}\n${err.message}`);
  }
  if (!parsed || !Array.isArray(parsed.rounds) || parsed.rounds.length === 0) {
    throw new Error('Файл вопросов должен содержать непустой массив "rounds".');
  }
  return parsed;
}

export function loadState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let pending = false;
export function saveState(statePath, state) {
  // Simple debounce so rapid mutations don't thrash the disk.
  if (pending) return;
  pending = true;
  setImmediate(() => {
    pending = false;
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(state));
    } catch (err) {
      console.error('Не удалось сохранить состояние игры:', err.message);
    }
  });
}
