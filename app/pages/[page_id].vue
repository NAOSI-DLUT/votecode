<script setup lang="ts">
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import htmlLang from "shiki/langs/html.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";

definePageMeta({ layout: false });

const route = useRoute();
const toast = useToast();
const colorMode = useColorMode();
const timer = ref(0);
const { user, clear } = useUserSession();

const pageId = computed(() => route.params.page_id as string);
const mode = ref<"preview" | "code">("preview");
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
const currentPrompt = computed(() => {
  const promptId = selectedPromptId.value ?? page.value?.latestPrompt;
  return promptId == null
    ? null
    : (prompts.value.find((prompt) => prompt.id === promptId) ?? null);
});
const currentPromptTitle = computed(() => {
  if (!currentPrompt.value) return "";
  return `#${currentPrompt.value.id} by @${currentPrompt.value.user?.name?.replace(/^@/, "") || "unknown"}`;
});
const currentPromptId = computed(() => currentPrompt.value?.id ?? null);
const { data: html, refresh: refreshHtml } = await useAsyncData<string>(
  () => `pages:${pageId.value}:html:${currentPromptId.value}`,
  async () =>
    currentPromptId.value
      ? await $fetch<string>(
          `/api/pages/${pageId.value}/html/${currentPromptId.value}`,
        )
      : "",
  {
    default: () => "",
    watch: [currentPromptId],
  },
);
const highlighter = await createHighlighterCore({
  themes: [githubLight, githubDark],
  langs: [htmlLang],
  engine: createJavaScriptRegexEngine(),
});
const highlightedHtml = computed(() =>
  highlighter.codeToHtml(html.value || "", {
    lang: "html",
    theme: colorMode.value === "dark" ? "github-dark" : "github-light",
  }),
);
const isPreviewingPrompt = (promptId: number) => currentPromptId.value === promptId;
const promptPlaceholder = computed(() => {
  if (!user.value) return "Please sign in to continue…";
  if (hasPrompt.value) return "This page already has a prompt";
  return "";
});

function promptStatusColor(status?: string) {
  if (status === "pending") return "warning";
  if (status === "approved") return "primary";
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
              icon: "i-lucide-eye",
              color: isPreviewingPrompt(prompt.id) ? "primary" : "neutral",
              onClick: () => {
                selectedPromptId.value = isPreviewingPrompt(prompt.id)
                  ? null
                  : prompt.id;
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
  $fetch<{ promptId: number }>(`/api/pages/${pageId.value}/prompts`, {
    method: "POST",
    body: { content: newPrompt.value },
  })
    .then((result) => {
      selectedPromptId.value = result.promptId;
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

function vote(promptId: number, nextVoted: boolean = true) {
  const prompt = prompts.value.find((item) => item.id === promptId);
  const previousVoted = prompt?.voted ?? false;
  if (prompt) {
    prompt.voted = nextVoted;
  }

  $fetch(`/api/pages/${pageId.value}/votes/${promptId}`, {
    method: "POST",
    body: { vote: nextVoted },
  }).catch((err) => {
    if (prompt) {
      prompt.voted = previousVoted;
    }
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
const latestPromptTimeout = ref<ReturnType<typeof setTimeout>>();
const eventSource = ref<EventSource>();

onMounted(() => {
  eventSource.value = new EventSource(`/api/pages/${pageId.value}/sse`);
  eventSource.value.onmessage = (event) => {
    const prompt = JSON.parse(event.data) as any;
    if (!prompt?.id) {
      return;
    }

    const { refresh, ...patch } = prompt;
    const index = prompts.value.findIndex((item) => item.id === prompt.id);
    if (index !== -1) {
      prompts.value[index] = Object.assign(prompts.value[index]!, patch);
    } else if ("content" in patch) {
      prompts.value = [...prompts.value, patch].sort(
        (a: any, b: any) => a.id - b.id,
      );
    } else {
      refreshPrompts();
    }

    if (prompt.status === "approved") {
      clearTimeout(latestPromptTimeout.value);
      latestPromptTimeout.value = setTimeout(() => {
        if (!page.value) return;
        page.value.latestPrompt = prompt.id;
        selectedPromptId.value = null;
        refreshPrompts();
      }, 1000);
    }

    if (refresh && currentPrompt.value?.id === prompt.id) {
      refreshHtml();
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
  clearTimeout(latestPromptTimeout.value);
  eventSource.value?.close();
});
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
          <UDashboardNavbar :title="currentPromptTitle">
            <template #leading>
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
            :srcdoc="html"
          ></iframe>
          <div
            v-else
            class="h-full overflow-auto [&_pre]:min-h-full [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-6 [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
            v-html="highlightedHtml"
          />
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
  </template>
</template>
