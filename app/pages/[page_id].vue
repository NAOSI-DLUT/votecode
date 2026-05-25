<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

type Prompts = InternalApi["/api/pages/:page_id/prompts"]["get"];
type Prompt = Prompts[number];

definePageMeta({ layout: false });

const route = useRoute();
const toast = useToast();
const timer = ref(0);
const { user, clear } = useUserSession();

const pageId = computed(() => route.params.page_id as string);
const mode = ref<"preview" | "code">("preview");
const showTree = ref(false);
const newPrompt = ref("");
const selectedPromptId = ref<number | null>(null);

useHead({
  title: () => pageId.value,
});

const { data: page, error } = await useFetch(`/api/pages/${pageId.value}`, {
  deep: true,
});
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
  });
}

const { data: prompts, refresh: refreshPrompts } = await useFetch(
  `/api/pages/${pageId.value}/prompts`,
  {
    deep: true,
    default: () => [],
  },
);

const { voteIntervalMinutes } = useAppConfig();
const hasPrompt = computed(() =>
  prompts.value.some(
    (prompt) => prompt.parent === (page.value?.latestPrompt ?? null),
  ),
);
const selectedPrompt = computed(() =>
  prompts.value.find((prompt) => prompt.id === selectedPromptId.value),
);
const displayHtml = computed(() => {
  if (selectedPrompt.value?.html) return selectedPrompt.value.html;
  return page.value?.html ?? "";
});
const promptPlaceholder = computed(() => {
  if (!user.value) return "Please sign in to continue…";
  if (hasPrompt.value) return "This page already has a prompt.";
  return "";
});

function promptStatusColor(status?: string) {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  if (status === "rejected") return "neutral";
  return "neutral";
}

const messages = computed<any[]>(() => {
  return prompts.value
    .map((prompt) => {
      const res: any[] = [
        {
          id: prompt.id.toString(),
          role: "user",
          avatar: {
            src: prompt.user?.avatar_url,
            chip: {
              size: "3xl",
              color: promptStatusColor(prompt.status),
              text: prompt.voteCount,
              position: "bottom-right",
            },
          },
          parts: [{ type: "text", text: prompt.content }],
          actions: [
            {
              label: "Vote to this prompt",
              icon: "i-lucide-thumbs-up",
              color: prompt.voted ? "primary" : "neutral",
              onClick: () => {
                vote(prompt.id, !prompt.voted);
              },
            },
            {
              label: "View generated HTML",
              icon: "i-lucide-file-code-2",
              onClick: () => {
                selectedPromptId.value = prompt.id;
              },
            },
            {
              label: "Copy to clipboard",
              icon: "i-lucide-copy",
              onClick: () => {
                copy(prompt.content);
              },
            },
          ],
          ui: {
            actions: "opacity-100",
          },
        },
      ];

      if (prompt.response) {
        res.push({
          id: `${prompt.id.toString()}-response`,
          role: "assistant",
          parts: [{ type: "text", text: prompt.response }],
          actions: [
            {
              label: "Copy to clipboard",
              icon: "i-lucide-copy",
              onClick: () => {
                copy(prompt.response!);
              },
            },
          ],
          ui: {
            actions: "opacity-100",
          },
        });
      }

      return res;
    })
    .flat();
});

function submitPrompt() {
  if (!newPrompt.value.trim() || !user.value || hasPrompt.value) return;
  $fetch(`/api/pages/${pageId.value}/prompts`, {
    method: "POST",
    body: { content: newPrompt.value },
  })
    .then(() => {
      newPrompt.value = "";
    })
    .catch((err) => {
      toast.add({
        title: "Failed to submit prompt",
        description: err.data?.message || err.message,
        color: "error",
      });
    });
}

function vote(promptId: number, vote: boolean = true) {
  $fetch(`/api/pages/${pageId.value}/votes/${promptId}`, {
    method: "POST",
    body: { vote },
  })
    .then(() => {
      refreshPrompts();
    })
    .catch((err) => {
      toast.add({
        title: "Failed to vote to prompt",
        description: err.data?.message || err.message,
        color: "error",
      });
    });
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
}

const timerInterval = ref<NodeJS.Timeout>();
const eventSource = ref<EventSource>();

onMounted(() => {
  eventSource.value = new EventSource(`/api/pages/${pageId.value}/sse`);
  eventSource.value.onmessage = (event) => {
    const data = JSON.parse(event.data) as { key: string; value: any };
    if (data.key.startsWith(`pages:${pageId.value}:prompts`)) {
      const promptId = Number(data.key.split(":").slice(-1)[0]);
      const prompt = data.value;
      const index = prompts.value.findIndex((item) => item.id === promptId);
      if (index !== -1) {
        prompts.value[index] = Object.assign(prompts.value[index]!, prompt);
      } else {
        refreshPrompts();
      }
      if (page.value?.latestPrompt === promptId && prompt?.html) {
        page.value.html = prompt.html;
      }
    } else if (data.key.startsWith(`pages:${pageId.value}:refresh`)) {
      refreshPrompts();
      $fetch(`/api/pages/${pageId.value}`).then((nextPage) => {
        page.value = nextPage as any;
      });
    }
  };
  timerInterval.value = setInterval(() => {
    timer.value =
      voteIntervalMinutes * 60 -
      (Math.floor(Date.now() / 1000 - (page.value?.offset || 0) * 60) %
        (voteIntervalMinutes * 60));
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timerInterval.value);
  eventSource.value?.close();
});

const treeRoots = computed(() =>
  prompts.value.filter((prompt) => prompt.parent === null),
);
function treeChildren(promptId: number) {
  return prompts.value.filter((prompt) => prompt.parent === promptId);
}
</script>

<template>
  <template v-if="page">
    <UDashboardGroup storage="local" class="h-screen">
      <UDashboardSidebar
        resizable
        :min-size="20"
        :default-size="30"
        :max-size="50"
      >
        <template #header>
          <UButton
            icon="i-lucide-vote"
            variant="ghost"
            class="w-full font-bold"
            to="/"
            label="votecode"
          />
        </template>

        <template #default>
          <UEmpty
            v-if="messages.length === 0"
            variant="naked"
            icon="i-lucide-message-square-code"
            title="No prompts yet"
            description="Be the first to submit a prompt!"
          />
          <UChatMessages
            v-else
            :messages="messages"
            :user="{ side: 'left' }"
            :assistant="{ avatar: { icon: 'i-lucide-bot' } }"
            status="submitted"
          >
            <template #content="{ message }">
              <template
                v-for="(part, index) in message.parts ?? []"
                :key="`${message.id}-${part.type}-${index}`"
              >
                <MDC
                  v-if="part.type === 'text' && message.role === 'assistant'"
                  :value="part.text"
                  :cache-key="`${message.id}-${index}`"
                  class="*:first:mt-0 *:last:mb-0"
                />
                <p
                  v-else-if="part.type === 'text' && message.role === 'user'"
                  class="whitespace-pre-wrap"
                >
                  {{ part.text }}
                </p>
              </template>
            </template>
            <template #indicator>
              <UButton
                class="px-0"
                color="neutral"
                variant="link"
                loading
                :label="`Waiting for vote result… (${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')})`"
              />
            </template>
          </UChatMessages>
        </template>

        <template #footer>
          <UChatPrompt
            variant="soft"
            :disabled="!user || hasPrompt"
            :placeholder="promptPlaceholder"
            v-model="newPrompt"
            @submit="submitPrompt"
          >
            <UChatPromptSubmit :disabled="!user || hasPrompt" />
          </UChatPrompt>
        </template>
      </UDashboardSidebar>

      <UDashboardPanel :ui="{ body: 'p-0!' }">
        <template #header>
          <UDashboardNavbar>
            <template #title>
              <UTabs
                v-model="mode"
                :items="[
                  { label: 'Preview', value: 'preview' },
                  { label: 'Code', value: 'code' },
                ]"
                size="xs"
                :content="false"
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
                  {
                    label: 'Logout',
                    icon: 'i-lucide-log-out',
                    onSelect: clear,
                  },
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
          </UDashboardNavbar>
        </template>

        <template #body>
          <iframe
            v-if="mode === 'preview'"
            class="h-full w-full"
            :srcdoc="displayHtml"
          ></iframe>
          <MonacoEditor
            v-else
            class="h-full"
            :model-value="displayHtml"
            lang="html"
            :options="{
              readOnly: true,
              theme: $colorMode.value === 'dark' ? 'vs-dark' : 'vs',
            }"
          />
        </template>
      </UDashboardPanel>
    </UDashboardGroup>

    <div class="fixed right-4 bottom-4 z-50 flex gap-2">
      <UButton
        icon="i-lucide-git-branch-plus"
        color="neutral"
        variant="solid"
        @click="showTree = true"
      >
        Prompt Tree
      </UButton>
      <UButton
        v-if="selectedPromptId"
        icon="i-lucide-x"
        color="neutral"
        variant="outline"
        @click="selectedPromptId = null"
      >
        Back To Latest
      </UButton>
    </div>

    <UModal v-model:open="showTree" title="Prompt Tree">
      <template #body>
        <div class="max-h-[60vh] space-y-3 overflow-auto">
          <div v-if="treeRoots.length === 0" class="text-sm text-muted">
            No prompts yet.
          </div>
          <div
            v-for="root in treeRoots"
            :key="`root-${root.id}`"
            class="space-y-2"
          >
            <UButton
              size="xs"
              variant="soft"
              :color="selectedPromptId === root.id ? 'primary' : 'neutral'"
              @click="selectedPromptId = root.id"
            >
              #{{ root.id }} · {{ root.status }}
            </UButton>
            <div class="space-y-2 border-l border-default pl-4">
              <UButton
                v-for="child in treeChildren(root.id)"
                :key="`child-${child.id}`"
                size="xs"
                variant="soft"
                :color="selectedPromptId === child.id ? 'primary' : 'neutral'"
                @click="selectedPromptId = child.id"
              >
                #{{ child.id }} · parent #{{ child.parent }} ·
                {{ child.status }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </template>
</template>
