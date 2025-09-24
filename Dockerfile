FROM node:18

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

# Install gosu for secure user switching
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

# Copy and make entrypoint script executable
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create /data directory as root and set ownership to node user
RUN mkdir -p /data && chown node:node /data

# Declare volume for external mounting
VOLUME ["/data"]

EXPOSE 3001

ENV NODE_ENV=production

# Add healthcheck (note: this will run as whatever user the container is running as)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Use entrypoint script to handle permissions, then start the app
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
