<script setup lang="ts">
const { user, clear } = useUserSession();
</script>

<template>
  <UHeader :toggle="false" class="border-b border-default">
    <template #left>
      <UButton
        icon="i-lucide-vote"
        variant="ghost"
        class="font-bold"
        to="/"
        label="votecode"
      />
    </template>

    <template #right>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-trophy"
        to="/rankings"
      />
      <UColorModeButton />
      <UDropdownMenu
        v-if="user"
        :items="[
          { label: 'Logout', icon: 'i-lucide-log-out', onSelect: clear },
        ]"
      >
        <UButton
          color="neutral"
          variant="ghost"
          :label="user.name"
          :avatar="{ src: user.avatar_url }"
        />
      </UDropdownMenu>
      <UButton
        v-else
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-in"
        label="Sign in"
        to="/api/auth/github"
        external
      />
    </template>
  </UHeader>

  <UMain>
    <UContainer>
      <slot />
    </UContainer>
  </UMain>
</template>
