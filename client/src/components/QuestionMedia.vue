<script setup>
import { computed } from 'vue';

const props = defineProps({
  media: { type: Object, default: null },
  gameId: { type: String, default: null }
});

function mediaUrl(path) {
  if (!path || !props.gameId) return null;
  return `/games/${props.gameId}/${path}`;
}

const imageUrl = computed(() => mediaUrl(props.media?.image));
const audioUrl = computed(() => mediaUrl(props.media?.audio));
const videoUrl = computed(() => mediaUrl(props.media?.video));
</script>

<template>
  <div v-if="imageUrl || audioUrl || videoUrl" class="question-media">
    <img v-if="imageUrl" :src="imageUrl" alt="" class="media-image" />
    <audio v-if="audioUrl" :src="audioUrl" controls autoplay class="media-audio" />
    <video v-if="videoUrl" :src="videoUrl" controls autoplay playsinline class="media-video" />
  </div>
</template>

<style scoped>
.question-media {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}
.media-image {
  max-width: 100%;
  max-height: min(50vh, 480px);
  object-fit: contain;
  border-radius: 10px;
}
.media-audio {
  width: min(100%, 480px);
}
.media-video {
  max-width: 100%;
  max-height: min(50vh, 480px);
  border-radius: 10px;
}
</style>
