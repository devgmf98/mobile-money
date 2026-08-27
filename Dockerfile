# Multi-stage build for the complete application

# Stage 1: Build frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN chmod +x node_modules/.bin/vite
RUN npm run build

# Stage 2: Setup backend
FROM node:20-alpine as backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install

# Stage 3: Final image
FROM node:20-alpine
WORKDIR /app

# Install PM2 globally for process management
RUN npm install -g pm2

# Copy backend
COPY --from=backend-builder /app/backend /app/backend
COPY backend/ /app/backend/

# Copy built frontend to public folder for serving
RUN mkdir -p /app/public
COPY --from=frontend-builder /app/frontend/dist /app/public

# No .env is copied. It is not in the repository (it holds JWT_SECRET and
# DB_PASSWORD), so COPY .env failed the build. Railway injects variables
# straight into the container environment, and dotenv.config() silently does
# nothing when the file is absent, leaving process.env intact — so every
# variable the app needs must be set in the Railway dashboard.

# server.js listens on process.env.PORT; Railway sets it and routes to it.
EXPOSE 8080

# Set working directory to backend
WORKDIR /app/backend

# Start the backend server
CMD ["node", "server.js"]
