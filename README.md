# votecode

🚩 Vote on prompts, code together and share the vibe!

## Setup

You need to prepare your GitHub OAuth App credentials. Follow the instructions [here](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app) to create an OAuth App and obtain the `Client ID` and `Client Secret`.

Then copy the `.env.example` file to `.env` and fill in your values.

Finally, run the following commands to install dependencies, build the project, and start the server:

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
