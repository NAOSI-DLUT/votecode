<script setup lang="ts">
import type { ChatMessageProps } from "@nuxt/ui";
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const { page } = useRoute().params;

const route = useRoute();
const toast = useToast();

const userMenuItems = computed(() => {
  return [
    {
      label: "Logout",
      icon: "lucide-log-out",
      onSelect: () => supabase.auth.signOut(),
    },
  ];
});

const messages = ref<ChatMessageProps[]>([]);
const hasPendingPrompt = ref(false);
const prompt = ref("");

function submitPrompt() {
  if (prompt.value.trim() === "") return;
  if (hasPendingPrompt.value) {
    supabase
      .from("prompts")
      .update({
        content: prompt.value,
      })
      .eq("page_id", page as string)
      .eq("user_id", user.value?.id as string)
      .then(({ error }) => {
        if (error) {
          toast.add({
            title: "Failed to update prompt",
            color: "error",
          });
        } else {
          toast.add({
            title: "Prompt updated",
            color: "success",
          });
        }
      });
  } else {
    supabase
      .from("prompts")
      .insert({
        content: prompt.value,
        page_id: page as string,
        user_id: user.value?.id as string,
      })
      .then(({ error }) => {
        if (error) {
          toast.add({
            title: "Failed to submit prompt",
            color: "error",
          });
        } else {
          toast.add({
            title: "Prompt submitted",
            color: "success",
          });
        }
      });
  }
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
