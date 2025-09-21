FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install

WORKDIR /app
COPY . .

WORKDIR /app/client
RUN npm run build

WORKDIR /app

RUN mkdir -p /data

EXPOSE 3001

ENV NODE_ENV=production

CMD ["npm", "start"]