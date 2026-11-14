# Truegle backend on Render (free web service, Docker). Same Express app that
# ran on Vercel; server.js calls app.listen when VERCEL != '1'.
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
# Non-root user must be able to write logs/ and public/ (sitemap).
RUN mkdir -p logs && chown -R node:node logs public
USER node
CMD ["node", "server.js"]
