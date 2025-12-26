FROM node:20-alpine

RUN npm install pm2 -g

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["pm2-runtime", "start", "ecosystem.config.js"]