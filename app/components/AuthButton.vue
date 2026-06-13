<script setup lang="ts">
const { user, clear, fetch } = useUserSession();
const toast = useToast();
const open = ref(false);
const loading = ref(false);

async function signInAnonymously() {
  loading.value = true;
  try {
    await $fetch("/api/auth/anonymous", { method: "POST" });
    await fetch();
    open.value = false;
  } catch (err: any) {
    toast.add({
      title: "Failed to sign in",
      description: err.data?.message || err.message,
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

const providers = computed(() => [
  {
    label: "GitHub",
    icon: "i-simple-icons-github",
    onClick: () => {
      window.location.href = "/api/auth/github";
    },
  },
  {
    label: "匿名登录",
    icon: "i-lucide-user-round",
    loading: loading.value,
    onClick: signInAnonymously,
  },
]);
</script>

<template>
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
  <UModal v-else v-model:open="open">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-log-in"
      label="Sign in"
    />

    <template #content>
      <UAuthForm
        title="Sign in to votecode"
        :fields="[]"
        :providers="providers"
        class="p-6"
      />
    </template>
  </UModal>
</template>
