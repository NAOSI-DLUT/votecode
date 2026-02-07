<script setup lang="ts">
import type { ChatMessageProps } from "@nuxt/ui";

const { user } = useUserSession();
const route = useRoute();
const toast = useToast();
const timer = useTimer();
const { prompts, refresh } = usePrompts();

const pageId = computed(() => route.params.page_id as string | undefined);

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
              color: prompt.pending
                ? "warning"
                : prompt.response
                  ? "primary"
                  : "neutral",
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
          ui: {
            actions: "opacity-100",
          },
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
          ui: {
            actions: "opacity-100",
          },
        });
      }
      return res;
    })
    .flat();
});

function vote(promptId: number, vote: boolean = true) {
  if (!pageId.value) return;
  $fetch(`/api/pages/${pageId.value}/votes/${promptId}`, {
    method: "POST",
    body: { vote },
  })
    .then(() => {
      refresh(pageId.value);
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
    v-else
    :messages="messages"
    :user="{ side: 'left' }"
    :assistant="{ avatar: { icon: 'i-lucide-bot' } }"
    status="submitted"
  >
    <template #indicator>
      <UButton
        class="px-0"
        color="neutral"
        variant="link"
        loading
        :label="`Waiting for vote result… (${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')})`"
      />
    </template>
  </UChatMessages>
</template>
