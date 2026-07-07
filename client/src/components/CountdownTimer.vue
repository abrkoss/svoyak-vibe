<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  deadline: { type: Number, default: null },
  label: { type: String, default: '' }
});

const remaining = ref(null);
let tick = null;

function update() {
  if (!props.deadline) {
    remaining.value = null;
    return;
  }
  remaining.value = Math.max(0, Math.ceil((props.deadline - Date.now()) / 1000));
}

watch(() => props.deadline, update, { immediate: true });

onMounted(() => {
  tick = setInterval(update, 250);
});

onUnmounted(() => {
  clearInterval(tick);
});
</script>

<template>
  <div v-if="deadline && remaining !== null" class="countdown" :class="{ urgent: remaining <= 5 }">
    <span v-if="label" class="countdown-label">{{ label }}</span>
    <span class="countdown-value">{{ remaining }}с</span>
  </div>
</template>

<style scoped>
.countdown {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  background: var(--panel-2);
  font-weight: 700;
}
.countdown.urgent {
  background: var(--red);
  color: #fff;
  animation: pulse 0.8s infinite;
}
.countdown-label { color: var(--muted); font-weight: 600; }
.countdown.urgent .countdown-label { color: rgba(255,255,255,0.85); }
.countdown-value { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}
</style>
