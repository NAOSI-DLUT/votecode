FROM node:alpine AS build

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/.output ./

EXPOSE 3000

CMD ["node", "server/index.mjs"]
