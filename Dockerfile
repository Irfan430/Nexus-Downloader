FROM node:20-bookworm-slim

WORKDIR /app

# Install system dependencies: chromium, ffmpeg, yt-dlp deps, aria2
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 python3-pip \
       ffmpeg chromium aria2 \
       ca-certificates fonts-liberation \
       libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
       libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
       libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer NOT to download its own Chrome — use system chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_CACHE_DIR=/tmp/.puppeteer-cache

# Writable runtime directories (Render free plan: only /tmp is reliably writable)
RUN mkdir -p /tmp/downloads /tmp/logs /tmp/.puppeteer-cache \
  && chmod -R 777 /tmp/downloads /tmp/logs /tmp/.puppeteer-cache

COPY package*.json ./
RUN npm install --omit=dev \
  && pip3 install --break-system-packages --no-cache-dir yt-dlp gallery-dl

COPY . .

EXPOSE 3000
CMD ["npm", "start"]