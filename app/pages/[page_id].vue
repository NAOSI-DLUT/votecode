<script setup lang="ts">
const route = useRoute();
const pageId = computed(() => route.params.page_id as string);
const { prompts, refresh } = usePrompts();

useHead({
  title: () => pageId.value,
});

const mode = useState("mode", () => "preview");
useFetch(`/api/pages/${pageId.value}/prompts`).then((res) => {
  prompts.value = res.data.value || [];
});
const { data: page, error } = useFetch(`/api/pages/${pageId.value}`, {
  deep: true,
});
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
  });
}

const { voteIntervalMinutes } = useAppConfig();
const timer = useTimer();

const timerInterval = ref<NodeJS.Timeout>();
const eventSource = ref<EventSource>();

onMounted(() => {
  eventSource.value = new EventSource(`/api/pages/${pageId.value}/sse`);
  eventSource.value.onmessage = (event) => {
    const data = JSON.parse(event.data) as { key: string; value: any };
    if (data.key.startsWith(`pages:${pageId.value}:html`)) {
      page.value!.html = data.value;
    } else if (data.key.startsWith(`pages:${pageId.value}:prompts`)) {
      const promptId = Number(data.key.split(":").slice(-1)[0]);
      const prompt = data.value;
      const index = prompts.value.findIndex((p) => p.id === promptId);
      if (index !== -1) {
        prompts.value[index] = Object.assign(prompts.value[index]!, prompt);
      }
    } else if (data.key.startsWith(`pages:${pageId.value}:refresh`)) {
      refresh(pageId.value);
    }
  };
  timerInterval.value = setInterval(() => {
    timer.value =
      voteIntervalMinutes * 60 -
      (Math.floor(Date.now() / 1000 - (page.value?.offset || 0) * 60) %
        (voteIntervalMinutes * 60));
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timerInterval.value);
  eventSource.value?.close();
});
</script>

<template>
  <template v-if="page">
    <iframe
      v-if="mode === 'preview'"
      class="h-full"
      :srcdoc="page.html"
    ></iframe>
    <MonacoEditor
      v-else
      class="h-full"
      v-model="page.html"
      lang="html"
      :options="{
        readOnly: true,
        theme: $colorMode.value === 'dark' ? 'vs-dark' : 'vs',
      }"
    />
  </template>
</template>
