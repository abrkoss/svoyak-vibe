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
</style>
