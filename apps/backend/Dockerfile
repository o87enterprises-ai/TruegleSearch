# Truegle backend on Hugging Face Spaces (Docker SDK). Same Express app that
# ran on Vercel; server.js calls app.listen when VERCEL != '1'.
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=7860
EXPOSE 7860
USER node
CMD ["node", "server.js"]
