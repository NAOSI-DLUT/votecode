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
      <AuthButton />
    </template>
  </UHeader>

  <UMain>
    <UContainer>
      <slot />
    </UContainer>
  </UMain>
</template>
