import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './pages/HomeView.vue';
import DisplayView from './pages/DisplayView.vue';
import HostView from './pages/HostView.vue';
import PlayerView from './pages/PlayerView.vue';

const routes = [
  { path: '/', component: HomeView },
  { path: '/display', component: DisplayView },
  { path: '/host', component: HostView },
  { path: '/player', component: PlayerView }
];

export default createRouter({
  history: createWebHistory(),
  routes
});
