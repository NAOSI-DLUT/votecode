<script setup lang="ts">
const toast = useToast();
const session = useUserSession();
const { data: pages } = useFetch("/api/pages");

const newPageId = ref("");
const canCreatePage = computed(
  () => session.ready.value && session.loggedIn.value,
);

onMounted(() => {
  void session.fetch();
});

function normalizePageId(pageId: string) {
  return pageId.trim().toLowerCase();
}

function createPage() {
  if (!session.loggedIn.value) {
    toast.add({
      title: "Please sign in",
      description: "You need to sign in before creating a page.",
      color: "warning",
    });
    return;
  }
  if (!newPageId.value) return;
  const pageId = normalizePageId(newPageId.value);
  if (!/^[a-z_-]+$/.test(pageId)) {
    toast.add({
      title: "Invalid page id",
      description: "Page id can only contain lowercase letters, hyphens, and underscores.",
      color: "warning",
    });
    return;
  }
  $fetch(`/api/pages/${pageId}`, {
    method: "POST",
  })
    .then((res) => {
      if (!res.length) {
        toast.add({
          title: "Oops!",
          description: `Page ${pageId} already exists`,
        });
      }
      navigateTo(`/` + pageId);
    })
    .catch((err) => {
      toast.add({
        title: "Failed to create page",
        description: err.data?.message || err.message,
        color: "error",
      });
    });
}
</script>

<template>
  <UContainer>
    <UPage>
      <UPageCTA
        title="votecode"
        description="Vote on prompts, code together and share the vibe 🎉"
        variant="naked"
      />
      <UPageList>
        <UPageCard
          v-for="page in pages"
          :key="page.id"
          variant="ghost"
          :title="page.id"
          :to="`/${page.id}`"
        >
          <template #footer>
            <UBadge icon="i-lucide-flame" variant="subtle"
              >{{ page.voteCount }} votes</UBadge
            >
          </template>
        </UPageCard>
      </UPageList>
      <UEmpty
        variant="naked"
        icon="i-lucide-plus"
        :title="pages?.length ? 'Or create another page…' : 'No pages yet'"
        :description="
          canCreatePage
            ? pages?.length
              ? ''
              : 'Create a page to get started'
            : session.ready
              ? 'Sign in to create a page'
              : 'Checking your session...'
        "
      >
        <template #actions>
          <UInput v-model="newPageId" :disabled="!canCreatePage" />
          <UButton :disabled="!canCreatePage" @click="createPage">
            Create page
          </UButton>
        </template>
      </UEmpty>
    </UPage>
  </UContainer>
</template>
