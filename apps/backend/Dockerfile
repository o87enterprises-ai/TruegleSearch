# Truegle backend on Render (free web service, Docker). Same Express app that
# ran on Vercel; server.js calls app.listen when VERCEL != '1'.
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# better-sqlite3 and bcrypt are native modules. When no prebuilt binary is
# fetched they compile with node-gyp, which needs python3/make/g++ — absent from
# node:20-slim (this was the "npm ci" exit 1 on Render). Install the toolchain,
# build, then remove it so the image stays small.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci --omit=dev \
 && apt-get purge -y --auto-remove python3 make g++ \
 && rm -rf /var/lib/apt/lists/* /root/.npm /root/.cache
COPY . .
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
# Non-root user must be able to write logs/ and public/ (sitemap).
RUN mkdir -p logs && chown -R node:node logs public
USER node
CMD ["node", "server.js"]
