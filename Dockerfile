FROM node:20-alpine

WORKDIR /app

# Ensure /app ownership is assigned to node user
RUN chown -R node:node /app

USER node

# Copy dependency manifests
COPY --chown=node:node package*.json ./

# Install production dependencies (if added in the future)
RUN npm install --omit=dev

# Copy application files
COPY --chown=node:node server.js ./
COPY --chown=node:node public/ ./public/

# Default environment configuration
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
