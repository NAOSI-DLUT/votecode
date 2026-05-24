<script setup lang="ts">
const route = useRoute();
const pageId = computed(() => route.params.page_id as string);
const { prompts, refresh, selectedPromptId, selectPrompt } = usePrompts();

useHead({
  title: () => pageId.value,
});

const mode = useState("mode", () => "preview");
const showTree = ref(false);

const { data: page, error } = await useFetch(`/api/pages/${pageId.value}`, {
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
const selectedPrompt = computed(() =>
  prompts.value.find((p) => p.id === selectedPromptId.value),
);
const displayHtml = computed(() => {
  if (selectedPrompt.value?.html) return selectedPrompt.value.html;
  return page.value?.html ?? "";
});

const timerInterval = ref<NodeJS.Timeout>();
const eventSource = ref<EventSource>();

onMounted(() => {
  eventSource.value = new EventSource(`/api/pages/${pageId.value}/sse`);
  eventSource.value.onmessage = (event) => {
    const data = JSON.parse(event.data) as { key: string; value: any };
    if (data.key.startsWith(`pages:${pageId.value}:prompts`)) {
      const promptId = Number(data.key.split(":").slice(-1)[0]);
      const prompt = data.value;
      const index = prompts.value.findIndex((p) => p.id === promptId);
      if (index !== -1) {
        prompts.value[index] = Object.assign(prompts.value[index]!, prompt);
      } else {
        refresh(pageId.value);
      }
      if (page.value?.latestPrompt === promptId && prompt?.html) {
        page.value.html = prompt.html;
      }
    } else if (data.key.startsWith(`pages:${pageId.value}:refresh`)) {
      refresh(pageId.value);
      $fetch(`/api/pages/${pageId.value}`).then((nextPage) => {
        page.value = nextPage as any;
      });
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

const treeRoots = computed(() =>
  prompts.value.filter((p) => p.parent === null),
);
function treeChildren(promptId: number) {
  return prompts.value.filter((p) => p.parent === promptId);
}
</script>

<template>
  <template v-if="page">
    <iframe
      v-if="mode === 'preview'"
      class="h-full"
      :srcdoc="displayHtml"
    ></iframe>
    <MonacoEditor
      v-else
      class="h-full"
      :model-value="displayHtml"
      lang="html"
      :options="{
        readOnly: true,
        theme: $colorMode.value === 'dark' ? 'vs-dark' : 'vs',
      }"
    />

    <div class="fixed right-4 bottom-4 z-50 flex gap-2">
      <UButton
        icon="i-lucide-git-branch-plus"
        color="neutral"
        variant="solid"
        @click="showTree = true"
      >
        Prompt Tree
      </UButton>
      <UButton
        v-if="selectedPromptId"
        icon="i-lucide-x"
        color="neutral"
        variant="outline"
        @click="selectPrompt(null)"
      >
        Back To Latest
      </UButton>
    </div>

    <UModal v-model:open="showTree" title="Prompt Tree">
      <template #body>
        <div class="space-y-3 max-h-[60vh] overflow-auto">
          <div v-if="treeRoots.length === 0" class="text-sm text-muted">
            No prompts yet.
          </div>
          <div v-for="root in treeRoots" :key="`root-${root.id}`" class="space-y-2">
            <UButton
              size="xs"
              variant="soft"
              :color="selectedPromptId === root.id ? 'primary' : 'neutral'"
              @click="selectPrompt(root.id)"
            >
              #{{ root.id }} · {{ root.status }}
            </UButton>
            <div class="pl-4 border-l border-default space-y-2">
              <UButton
                v-for="child in treeChildren(root.id)"
                :key="`child-${child.id}`"
                size="xs"
                variant="soft"
                :color="selectedPromptId === child.id ? 'primary' : 'neutral'"
                @click="selectPrompt(child.id)"
              >
                #{{ child.id }} · parent #{{ child.parent }} · {{ child.status }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </template>
</template>
