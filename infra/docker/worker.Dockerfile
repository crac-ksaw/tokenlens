FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN corepack pnpm install --frozen-lockfile=false
COPY . .
RUN corepack pnpm --filter @tokenlens/shared build && corepack pnpm --filter @tokenlens/worker build
CMD ["node", "apps/worker/dist/index.js"]