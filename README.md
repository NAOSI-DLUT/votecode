# votecode

🚩 Vote on prompts, code together and share the vibe!

## Setup

> [!IMPORTANT]
> This project can ONLY run in a persistent platform like node-server, and is not suitable for serverless platforms because of the use of memory storage, SSE and cron jobs.

You need to prepare your GitHub OAuth App credentials. Follow the instructions [here](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app) to create an OAuth App and obtain the `Client ID` and `Client Secret`.

Then copy the `.env.example` file to `.env` and fill in your values.

### Docker

```bash
docker pull saurlax/votecode:latest
docker run -d -p 3000:3000 --name votecode --env-file .env saurlax/votecode:latest
```

### Manual

```bash
pnpm install
pnpm run build
node .output/server/index.mjs
```

## Development

```bash
pnpm install
pnpm run dev
```

## Why

The inspiration for this project originated from a conversation. We envisioned an activity where multiple people could collaborative "vibe coding" together.

At the same time, this is a "pure Nuxt" experiment. You can see that the technology stack we used is basically from the [UnJS](https://unjs.io/) ecosystem. It might not work perfectly, but it's very cool! We also offer a version using Supabase, and you can find it in the [supabase branch](https://github.com/NAOSI-DLUT/votecode/tree/supabase).
