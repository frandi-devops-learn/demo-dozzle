FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
USER nodejs
EXPOSE 3000
ENV NODE_ENV=production
ENV SERVICE_NAME=demo-dozzle
CMD ["node", "src/index.js"]