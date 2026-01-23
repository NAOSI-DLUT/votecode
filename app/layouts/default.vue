<script setup lang="ts">
const items = computed(() => {
  return [
    { label: "Chat & Vote", icon: "lucide-message-square-code" },
    { label: "Room", icon: "lucide-file-code-corner" },
    { label: "Leaderboard", icon: "lucide-award" },
  ];
});
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsed>
      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="items"
          :collapsed="collapsed"
          orientation="vertical"
        />
      </template>
    </UDashboardSidebar>
    <UDashboardPanel resizable :min-size="10" :default-size="20" :max-size="40">
      <template #body>panel</template>
    </UDashboardPanel>
    <UDashboardPanel>
      <slot />
    </UDashboardPanel>
  </UDashboardGroup>
</template>
