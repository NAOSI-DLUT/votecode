<script setup lang="ts">
import type { ChatMessageProps } from "@nuxt/ui";

const { user } = useUserSession();
const route = useRoute();
const toast = useToast();

const pageId = computed(() => route.params.page_id as string | undefined);

const { data: prompts } = useAsyncData(
  async () => {
    if (pageId.value) {
      const newPrompts = await $fetch(`/api/pages/${pageId.value}/prompts`);
      // recover pending prompt content
      const pendingPrompt = newPrompts.find(
        (p) => p.user_id === user.value?.id && !p.response,
      );
      if (pendingPrompt) {
        newPrompt.value = pendingPrompt.content;
      }
      return newPrompts;
    } else {
      newPrompt.value = "";
      return [];
    }
  },
  { watch: [pageId] },
);

const hasPendingPrompt = computed(() => {
  if (!prompts.value || !user.value) return false;
  return prompts.value.some((p) => p.user_id === user.value?.id && !p.response);
});

const newPrompt = ref("");
const messages = computed<(ChatMessageProps & { id: string })[]>(() => {
  if (!prompts.value) return [];
  return prompts.value
    .map((prompt) => {
      const res: any = [
        {
          id: prompt.id.toString(),
          role: "user",
          avatar: {
            src: prompt.user?.avatar_url,
            chip: {
              size: "3xl",
              text: prompt.voteCount,
              position: "bottom-right",
            },
          },
          parts: [{ type: "text", text: prompt.content }],
          actions: [
            {
              label: "Vote to this prompt",
              icon: "i-lucide-thumbs-up",
              color: prompt.voted ? "primary" : "neutral",
              onClick: () => {
                vote(prompt.id, !prompt.voted);
              },
            },
            {
              label: "Copy to clipboard",
              icon: "i-lucide-copy",
              onClick: () => {
                copy(prompt.content);
              },
            },
          ],
        },
      ];
      if (prompt.response) {
        res.push({
          id: `${prompt.id.toString()}-response`,
          role: "assistant",
          parts: [{ type: "text", text: prompt.response }],
          actions: [
            {
              label: "Copy to clipboard",
              icon: "i-lucide-copy",
              onClick: () => {
                copy(prompt.response!);
              },
            },
          ],
        });
      }
      return res;
    })
    .flat();
});

function updatePrompts() {
  if (pageId.value) {
    $fetch<any>(`/api/pages/${pageId.value}/prompts`).then((newPrompts) => {
      prompts.value = newPrompts;
    });
  } else {
    prompts.value = [];
  }
}

function vote(promptId: number, vote: boolean = true) {
  if (!pageId.value) return;
  $fetch(`/api/pages/${pageId.value}/votes/${promptId}`, {
    method: "POST",
    body: { vote },
  })
    .then(() => {
      updatePrompts();
      toast.add({
        title: vote ? "Voted to prompt" : "Removed vote from prompt",
        color: "success",
      });
    })
    .catch((err) => {
      toast.add({
        title: "Failed to vote to prompt",
        color: err.data?.message || err.message,
      });
    });
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.add({
    title: "Prompt copied to clipboard",
    color: "success",
  });
}

const interval = ref<NodeJS.Timeout>();

onMounted(() => {
  interval.value = setInterval(updatePrompts, 5000);
});

onUnmounted(() => {
  clearInterval(interval.value);
});

function submitPrompt() {
  if (newPrompt.value.trim() === "") return;
  $fetch(`/api/pages/${pageId.value}/prompts`, {
    method: "POST",
    body: { content: newPrompt.value },
  })
    .then(() => {
      updatePrompts();
      toast.add({
        title: "Prompt submitted",
        color: "success",
      });
    })
    .catch((err) => {
      toast.add({
        title: "Failed to submit prompt",
        color: err.data?.message || err.message,
      });
    });
}
</script>

<template>
  <UEmpty
    v-if="route.path === '/'"
    variant="naked"
    icon="i-lucide-message-square-code"
    title="👋 Hi there"
    description="Select a page to start votecoding!"
  />
  <UEmpty
    v-else-if="messages.length === 0"
    variant="naked"
    icon="i-lucide-message-square-code"
    title="No prompts yet"
    description="Be the first to submit a prompt!"
  />

  <UChatMessages
    :messages="messages"
    :user="{ side: 'left' }"
    :assistant="{ avatar: { icon: 'i-lucide-bot' } }"
    :status="hasPendingPrompt ? 'submitted' : 'ready'"
  >
    <template #indicator>
      <UButton
        class="px-0"
        color="neutral"
        variant="link"
        loading
        label="Waiting for vote result…"
      />
    </template>
  </UChatMessages>

  <UChatPrompt
    variant="soft"
    :disabled="route.path === '/' || !user"
    :placeholder="user ? '' : 'Please sign in to continue…'"
    v-model="newPrompt"
    @submit="submitPrompt"
  >
    <UChatPromptSubmit :disabled="route.path === '/' || !user" />
  </UChatPrompt>
</template>
