FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install

# Install Playwright's Chromium + all required system dependencies
RUN npx playwright install --with-deps chromium

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
