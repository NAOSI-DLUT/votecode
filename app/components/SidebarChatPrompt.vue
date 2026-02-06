<script setup lang="ts">
const { user } = useUserSession();
const route = useRoute();
const toast = useToast();
const { refresh } = usePrompts();

const pageId = computed(() => route.params.page_id as string | undefined);
const newPrompt = ref("");

function submitPrompt() {
  if (!pageId.value) return;
  if (newPrompt.value.trim() === "") return;
  $fetch(`/api/pages/${pageId.value}/prompts`, {
    method: "POST",
    body: { content: newPrompt.value },
  })
    .then(() => {
      refresh(pageId.value);
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
