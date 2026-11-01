# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Optional build-time argument for backend URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve the Static Files
FROM node:20-alpine AS runner

WORKDIR /app

# Install lightweight static file server
RUN npm install -g serve

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Railway dynamically injects PORT (defaults to 3000)
ENV PORT=3000
EXPOSE 3000

# Start server respecting dynamic Railway PORT
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
