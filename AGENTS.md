This project is built with `nuxt@4` + `@nuxt/hub` + `@nuxt/ui` + `nuxt-auth-utils`. Please use Context7 whenever you need framework or library documentation.

- Most files from `vue`, `shared`, `utils`, `types`, and Nuxt runtime APIs are auto-imported by Nuxt. Do not add imports for them unless the codebase already does so explicitly.

## Commands

- `pnpm install`: Install dependencies and run Nuxt prepare through the `postinstall` script.
- `pnpm run dev`: Start the Nuxt development server.
- `pnpm run build`: Build the Nuxt application for production.
- `node .output/server/index.mjs`: Start the built production server after `pnpm run build`.
- `pnpm test`: Run all Vitest tests with `vitest run`.
- `pnpm vitest run server/utils/generate.test.ts`: Run a single test file.
- `pnpm nuxt typecheck`: Run Nuxt type checking when API, schema, or shared typing changes are substantial.
- `pnpm nuxt db generate`: Generate database migration artifacts after changing `server/db/schema.ts`.

There is currently no dedicated lint script in `package.json`.

## Setup Notes

The app requires GitHub OAuth credentials. Copy `.env.example` to `.env` and set the GitHub OAuth client ID/secret, session password, database URL, and OpenAI-compatible model configuration.

## Architecture Overview

This is a Nuxt 4 app using Nuxt UI, NuxtHub, `nuxt-auth-utils`, Drizzle, Vitest, `xsai`, and `nuxt-monaco-editor`. NuxtHub DB is configured as PostgreSQL, and Nitro scheduled tasks run `pickPrompts` every minute.

The frontend is intentionally small. `app/app.vue` wraps the app in `UApp`; `app/layouts/default.vue` owns the navigation, auth controls, rankings link, and color mode toggle. `app/pages/index.vue` lists pages and lets authenticated users create pages. `app/pages/rankings.vue` shows user/page vote rankings. `app/pages/[page_id].vue` is the main collaborative page: it loads page metadata, prompt lists, prompt HTML, subscribes to SSE updates, renders an iframe preview via `srcdoc`, and shows HTML in Monaco.

The backend is organized around Nuxt server routes under `server/api`. Page routes create/fetch pages, prompt routes list/create prompts, vote routes toggle votes, rankings returns aggregate leaderboard data, and GitHub auth lives in `server/api/auth/github.ts`. Authentication should continue to use `getUserSession(event)` for optional sessions and `requireUserSession(event)` for protected routes.

The database schema is in `server/db/schema.ts`. The core entities are `users`, `pages`, `prompts`, and `votes`. `pages.latestPrompt` points to the approved branch head. `prompts.parent` links a prompt to the previous approved prompt. Each prompt stores its own `html`, `response`, and `status`. Do not hand-write migration SQL; edit the schema and run `pnpm nuxt db generate`.

Prompt generation is centralized in `server/utils/generate.ts`. Prompt creation returns quickly and schedules generation in the background. Generation loads the prompt, reads the parent prompt HTML if any, streams model output through `xsai`, and exposes `read_html`, `write_html`, and exact-text `replace_html` tools to the model. HTML write/replace calls immediately persist the full HTML to the prompt row and broadcast `{ id, refresh: true }` through `pages:<pageId>`.

Realtime behavior uses Nuxt storage as the coordination layer. `pages:<pageId>` carries prompt-level updates such as vote counts, response text, status, and HTML refresh signals. The page SSE endpoint is `server/api/pages/[page_id]/sse.ts`; the HTML endpoint always returns the latest database `html` for a prompt.


Voting selection is handled by `server/tasks/pickPrompts.ts`, scheduled every minute by Nitro. It uses `appConfig.voteIntervalMinutes` and each page offset to pick eligible pages. For each page, it considers prompts under the current branch head, rejects the round’s candidates, approves the highest-voted winner, updates `pages.latestPrompt`, and broadcasts status changes. This task should not re-run generation.

## Frontend

- Prioritize Nuxt UI components and existing project patterns before writing custom Tailwind-heavy UI.
- For toast error messages, use `e.data?.message || e.message` so backend errors surface correctly.
- Keep page components concise. Avoid introducing tiny helper functions unless they materially improve clarity.
- When displaying prompt-related UI, remember each prompt has its own `html` and `status`. The page view can represent either the latest approved prompt or a user-selected prompt version.
- SSE updates under `pages:${pageId}` represent prompt-level state changes and `{ id, refresh: true }` HTML refresh signals.


## Backend

- Authentication should use `const { user } = await getUserSession(event)` or `const { user } = await requireUserSession(event)` from `nuxt-auth-utils`.
- Keep API handlers simple. Avoid unnecessary custom types or over-validation.
- When request validation is needed, use Zod inline with `z.object({ ... }).parse(body)` rather than extracting tiny schemas.
- Database access should use `import { db, schema } from "@nuxthub/db"`.
- Prefer returning database results directly when no reshaping is needed.
- When a route has multiple sub-paths, prefer directory-based routing with `index.<method>.ts`.
- Resource lookups should return `404` when the target page/prompt/resource does not exist.

## Database

- The database schema lives in `server/db/schema.ts`.
- Never hand-write or manually edit SQL migration files under `server/db/migrations/**`; they are generated artifacts.
- Make schema changes only in `server/db/schema.ts`.
- Generate or update migration artifacts with `pnpm nuxt db generate`.
- Prompt status is `pending` / `approved` / `rejected`.
- For prompt branching, keep in mind:

  - `pages.latestPrompt` points to the currently approved prompt on the main line
  - `prompts.parent` links a prompt to its previous prompt
  - each prompt stores its own `html`

## Generate Flow

- `server/utils/generate.ts` should stay focused: generate a single prompt from `promptId`, using the prompt content and its parent html.
- Prompt submission should return quickly and continue generation in the background.
- Voting/cron selection should only decide which prompt becomes the new approved branch head. It should not re-run generation.

## Verification

- After code changes, run `pnpm test`.
- When schema or API typing changes are substantial, also run `pnpm nuxt typecheck`.

