FROM node:20-alpine

WORKDIR /app

# Copy dependency definition
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy backend source and .env
COPY . .

# Expose port (Railway injects PORT dynamically)
EXPOSE 5000

# Start Express server
CMD ["node", "server.js"]
