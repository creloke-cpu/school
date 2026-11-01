# ========================================================
# Stage 1: Build React Frontend (Vite)
# ========================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ========================================================
# Stage 2: Production Node.js Server & Serve React
# ========================================================
FROM node:20-alpine AS runner

WORKDIR /app/backend

ENV NODE_ENV=production

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --only=production

# Copy backend source
COPY backend/ ./

# Copy compiled React distribution from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Railway automatically provides $PORT at runtime
EXPOSE 5000

# Start Express server
CMD ["node", "server.js"]
