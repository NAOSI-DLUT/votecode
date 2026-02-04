<script setup lang="ts">
import { page } from "#build/ui";
import type { InternalApi } from "nitropack/types";
const { user, clear } = useUserSession();
const route = useRoute();
const toast = useToast();

const pageId = computed(() => route.params.page_id as string | undefined);
const userMenuItems = computed(() => {
  return [{ label: "Logout", icon: "lucide-log-out", onSelect: clear }];
});

const { data: prompts } = useAsyncData(
  async () => {
    if (pageId.value) {
      return await $fetch(`/api/pages/${pageId.value}/prompts`);
    } else {
      return [];
    }
  },
  { watch: [pageId] },
);
const newPrompt = ref("");
const messages = computed(() => {
  if (!prompts.value) return [];
  return prompts.value
    .map((prompt) => {
      const res: any = [
        {
          id: prompt.prompts.id.toString(),
          role: "user",
          parts: [{ type: "text", text: prompt.prompts.content }],
          avatar: { src: prompt.users?.avatar_url },
        },
      ];
      if (prompt.prompts.response) {
        res.push({
          id: `${prompt.prompts.id.toString()}-response`,
          role: "assistant",
          parts: [{ type: "text", text: prompt.prompts.response }],
        });
      }
      return res;
    })
    .flat();
});

async function updatePrompts() {
  if (pageId.value) {
    prompts.value = await $fetch<any>(`/api/pages/${pageId.value}/prompts`);
  } else {
    prompts.value = [];
  }
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
  <UDashboardGroup storage="local">
    <UDashboardSidebar
      resizable
      :min-size="20"
      :default-size="30"
      :max-size="50"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header>
        <UButton
          icon="lucide-vote"
          variant="ghost"
          class="w-full overflow-hidden whitespace-nowrap text-ellipsis"
          to="/"
        >
          <b>votecode</b><sup>by NAOSI</sup>
        </UButton>
      </template>
      <template #default>
        <UEmpty
          v-if="route.path === '/'"
          variant="naked"
          icon="lucide-message-square-code"
          title="👋 Hi there"
          description="Select a page to start votecoding!"
        />
        <UEmpty
          v-else-if="messages.length === 0"
          variant="naked"
          icon="lucide-message-square-code"
          title="No prompts yet"
          description="Be the first to submit a prompt!"
        />
        <UChatMessages
          :messages="messages"
          :user="{ side: 'left' }"
          :assistant="{ avatar: { icon: 'lucide-bot' } }"
        />
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
    </UDashboardSidebar>
    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar title="Preview">
          <template #right>
            <UDropdownMenu v-if="user" :items="userMenuItems">
              <UButton
                color="neutral"
                variant="ghost"
                class="w-full"
                :label="user.name"
                :avatar="{ src: user.avatar_url }"
              />
            </UDropdownMenu>
            <UButton
              v-else
              color="neutral"
              variant="ghost"
              class="w-full"
              icon="lucide-log-in"
              label="Sign in with GitHub"
              to="/api/auth/github"
              external
            />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
