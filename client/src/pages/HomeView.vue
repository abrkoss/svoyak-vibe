<script setup>
import { ref, onMounted, watch } from 'vue';
import QRCode from 'qrcode';

const playerUrl = ref('http://localhost/player');
const qrSrc = ref(null);

async function generateQr(url) {
  try {
    qrSrc.value = await QRCode.toDataURL(String(url), { margin: 1, scale: 6 });
  } catch (err) {
    console.warn('QR generation failed:', err);
    qrSrc.value = null;
  }
}

onMounted(async () => {
  try {
    const response = await fetch('/api/connection');
    if (response.ok) {
      const data = await response.json();
      playerUrl.value = data.playerUrl || `${window.location.origin}/player`;
    } else {
      playerUrl.value = `${window.location.origin}/player`;
    }
  } catch (error) {
    console.warn('Connection API fetch failed:', error);
    playerUrl.value = `${window.location.origin}/player`;
  }
  await generateQr(playerUrl.value);
});

watch(playerUrl, (v) => {
  if (v) generateQr(v);
});
</script>

<template>
  <div class="home">
    <h1>Своя игра</h1>
    <p class="subtitle">Выберите роль на этом устройстве</p>
    <div class="role-grid">
      <router-link class="role-card display" to="/display">
        <span class="role-icon">🖥️</span>
        <span class="role-name">Экран-показ</span>
        <span class="role-desc">Табло и вопросы для всех</span>
      </router-link>
      <router-link class="role-card host" to="/host">
        <span class="role-icon">🎤</span>
        <span class="role-name">Ведущий</span>
        <span class="role-desc">Управление игрой</span>
      </router-link>
      <router-link class="role-card player" to="/player">
        <span class="role-icon">📱</span>
        <span class="role-name">Игрок</span>
        <span class="role-desc">Кнопка ответа</span>
      </router-link>
    </div>
    <div class="connect">
      <img v-if="qrSrc" :src="qrSrc" class="connect__img" alt="QR for connection" />
      <div class="connect__meta">
        <h3 class="connect__title">Подключение игроков</h3>
        <div class="connect__subtitle">
          Отсканируйте QR-код<br>
          или откройте ссылку
        </div>
        <a class="connect__link" :href="playerUrl" target="_blank" rel="noreferrer">{{ playerUrl }}</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
}
h1 { font-size: 3rem; margin: 0; color: var(--accent); }
.subtitle { color: var(--muted); margin-bottom: 2rem; }
.role-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
}
.role-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 220px;
  padding: 2rem;
  background: var(--panel);
  border: 2px solid var(--border);
  border-radius: 16px;
  text-decoration: none;
  color: var(--fg);
  transition: transform 0.15s, border-color 0.15s;
}
.role-card:hover { transform: translateY(-4px); border-color: var(--accent); }
.role-icon { font-size: 3rem; }
.role-name { font-size: 1.4rem; font-weight: 700; }
.role-desc { color: var(--muted); font-size: 0.9rem; }

.connect {display: flex; align-items: center; justify-content: center; gap: 2rem; padding: 1.5rem 2rem; }
.connect__title { margin: 0; font-size: 2rem; font-weight: 800; color: white;}
.connect__img { width: 250px; height: 250px; flex-shrink: 0; border-radius: 12px; background: white; padding: 10px; }
.connect__text { font-size: 1.4rem; font-weight: 800; color: var(--muted); text-align: center; }
.connect__link { margin-top: 1rem; font-size: 1.6rem; font-weight: 700; color: var(--accent); text-decoration: none; overflow-wrap: anywhere; }
</style>
