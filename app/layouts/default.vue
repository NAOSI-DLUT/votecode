<script setup lang="ts">
import type { ChatMessageProps } from "@nuxt/ui";
const { user, clear } = useUserSession();
const { page } = useRoute().params;

const route = useRoute();
const toast = useToast();

const userMenuItems = computed(() => {
  return [{ label: "Logout", icon: "lucide-log-out", onSelect: clear }];
});

const messages = ref<ChatMessageProps[]>([]);
const prompt = ref("");

function submitPrompt() {
  if (prompt.value.trim() === "") return;
  $fetch
    .raw(`/api/pages/${page}/prompts`, {
      method: "POST",
      body: { content: prompt.value, page },
    })
    .then(({ status }) => {
      toast.add({
        title: status === 201 ? "Prompt submitted" : "Prompt updated",
        color: "success",
      });
    })
    .catch(() => {
      toast.add({
        title: "Failed to submit prompt",
        color: "error",
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
        <UChatMessages :messages="messages" />
        <UChatPrompt
          variant="soft"
          :disabled="route.path === '/' || !user"
          :placeholder="user ? '' : 'Please sign in to continue…'"
          v-model="prompt"
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
