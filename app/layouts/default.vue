<script setup lang="ts">
const { user, clear } = useUserSession();

const userMenuItems = computed(() => {
  return [{ label: "Logout", icon: "i-lucide-log-out", onSelect: clear }];
});
const tabsItems = computed(() => {
  return [
    {
      label: "Preview",
      value: "preview",
    },
    {
      label: "Code",
      value: "code",
    },
  ];
});
const mode = useState("mode", () => "preview");
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
          icon="i-lucide-vote"
          variant="ghost"
          class="w-full overflow-hidden whitespace-nowrap text-ellipsis"
          to="/"
        >
          <b>votecode</b><sup>by NAOSI</sup>
        </UButton>
      </template>
      <template #default>
        <Chat />
      </template>
    </UDashboardSidebar>
    <UDashboardPanel :ui="{ body: 'p-0!' }">
      <template #header>
        <UDashboardNavbar>
          <template #title>
            <UTabs
              v-model="mode"
              :items="tabsItems"
              size="xs"
              :content="false"
            />
          </template>
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
              icon="i-lucide-log-in"
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
