# Truegle backend on Render (free web service, Docker). Same Express app that
# ran on Vercel; server.js calls app.listen when VERCEL != '1'.
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# better-sqlite3 has no prebuilt binary for this Node build, so npm compiles it;
# slim images lack Python/make/g++ (Render build failed without them).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/* \
 && npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
USER node
CMD ["node", "server.js"]
