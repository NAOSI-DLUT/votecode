<script setup lang="ts">
const toast = useToast();
const { user } = useUserSession();
const { data: pages } = useFetch("/api/pages");

const newPageId = ref("");

function createPage() {
  if (!user.value) {
    toast.add({
      title: "Please sign in",
      description: "You need to sign in before creating a page.",
      color: "warning",
    });
    return;
  }
  if (!newPageId.value) return;
  $fetch(`/api/pages/${newPageId.value}`, {
    method: "POST",
  })
    .then((res) => {
      if (!res.length) {
        toast.add({
          title: "Oops!",
          description: `Page ${newPageId.value} already exists`,
        });
      }
      navigateTo(`/` + newPageId.value);
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
        :description="user ? (pages?.length ? '' : 'Create a page to get started') : 'Sign in to create a page'"
      >
        <template #actions>
          <UInput v-model="newPageId" :disabled="!user" />
          <UButton :disabled="!user" @click="createPage">Create page</UButton>
        </template>
      </UEmpty>
    </UPage>
  </UContainer>
</template>
