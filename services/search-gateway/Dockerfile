# Hugging Face Docker Space: runs as uid 1000 (the node image's `node` user) and listens on app_port 7860.
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
USER node
ENV PORT=7860 NODE_ENV=production
EXPOSE 7860
CMD ["node", "server.js"]
