FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=3000
ENV DATABASE_PATH=/data/book.sqlite
ENV CLIENT_DIR=/app/dist/client
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
