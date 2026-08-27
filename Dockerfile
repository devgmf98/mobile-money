# Multi-stage build for the complete application

# Stage 1: Build frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
# --include=dev is required: vite and @vitejs/plugin-react are devDependencies,
# and railway.json sets NODE_ENV=production, under which `npm install` skips
# devDependencies — leaving no node_modules/.bin/vite and failing the build on
# the next line. Explicit here so the build does not depend on NODE_ENV.
RUN npm install --include=dev
COPY frontend/ .
# Tolerated rather than required: on a clean install npm already sets the
# executable bit, and a missing file here should not abort the build.
RUN chmod +x node_modules/.bin/vite || true
RUN npm run build

# Stage 2: Setup backend
FROM node:20-alpine as backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
# --omit=dev keeps the runtime image lean; the backend needs no build step.
RUN npm install --omit=dev

# Stage 3: Final image
FROM node:20-alpine
WORKDIR /app

# Copy backend (node_modules from the builder stage, then the source over it)
COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
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
