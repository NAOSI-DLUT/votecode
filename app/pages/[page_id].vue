<script setup lang="ts">
const route = useRoute();
const pageId = computed(() => route.params.page_id as string);

useHead({
  title: () => pageId.value,
});

const mode = useState("mode", () => "preview");
const { data: pages, error } = useFetch(`/api/pages/${pageId.value}`);
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
  });
}

const { voteIntervalMinutes } = useAppConfig();
const { refresh } = usePrompts();
const timer = useTimer();

function refreshEverything() {
  refresh(pageId.value);
  $fetch(`/api/pages/${pageId.value}`).then((res) => {
    pages.value = res;
  });
}

const updateInterval = ref<NodeJS.Timeout>();
const timerInterval = ref<NodeJS.Timeout>();

onMounted(() => {
  refreshEverything();
  updateInterval.value = setInterval(refreshEverything, 10000);
  timerInterval.value = setInterval(() => {
    timer.value =
      voteIntervalMinutes * 60 -
      (Math.floor(Date.now() / 1000) % (voteIntervalMinutes * 60));
    if (timer.value > voteIntervalMinutes * 60 - 1) {
      $fetch(`/api/pages/${pageId.value}/generate`);
    }
  }, 1000);
});

onUnmounted(() => {
  clearInterval(updateInterval.value);
  clearInterval(timerInterval.value);
});
</script>

<template>
  <template v-if="pages">
    <iframe
      v-if="mode === 'preview'"
      class="h-full"
      :srcdoc="pages.html"
    ></iframe>
    <MonacoEditor
      v-else
      class="h-full"
      v-model="pages.html"
      lang="html"
      :options="{
        readOnly: true,
        theme: $colorMode.value === 'dark' ? 'vs-dark' : 'vs',
      }"
    />
  </template>
</template>
