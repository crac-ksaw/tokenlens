FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN corepack pnpm install --frozen-lockfile=false
COPY . .
RUN corepack pnpm --filter @tokenlens/shared build && corepack pnpm --filter @tokenlens/api build
CMD ["node", "apps/api/dist/index.js"]