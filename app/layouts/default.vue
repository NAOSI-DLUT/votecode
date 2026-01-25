<script setup lang="ts">
const { user, clear } = useUserSession();

const route = useRoute();

const userMenuItems = computed(() => {
  return [{ label: "Logout", icon: "lucide-log-out", onSelect: clear }];
});
</script>

<template>
  <UDashboardGroup>
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
        <UChatMessages />
        <UChatPrompt variant="soft">
          <UChatPromptSubmit />
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
