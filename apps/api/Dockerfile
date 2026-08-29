FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package files
COPY package*.json ./
COPY packages/ packages/
COPY apps/ apps/
COPY tsconfig*.json ./

# Install dependencies and build
RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps

EXPOSE 4000

CMD ["npm", "--workspace=@recoveryos/api", "run", "start"]
