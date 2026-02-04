import express from 'express';
import sequelize from './config/database.js';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setIO } from './utils/socket.js';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const flash = require('connect-flash');

const app = express();
const httpServer = createServer(app);

// Allow both common frontend ports for development (5173, 5174)
// and also read from FRONTEND_URL, API_URL, and API_PRODUCTION_URL env vars if set
const allowedOrigins = [
  'https://gpay-ss.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174'
];

// Add production URLs from environment variables
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.API_URL && !allowedOrigins.includes(process.env.API_URL)) {
  allowedOrigins.push(process.env.API_URL);
}
if (process.env.API_PRODUCTION_URL && !allowedOrigins.includes(process.env.API_PRODUCTION_URL)) {
  allowedOrigins.push(process.env.API_PRODUCTION_URL);
}

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// expose io to controllers via utils/socket.js to avoid circular imports
setIO(io);// Middleware


app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  allowedHeaders: ['sessionId', 'Content-Type', 'Authorization'],
  exposedHeaders: ['sessionId'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests for all routes
app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  allowedHeaders: ['sessionId', 'Content-Type', 'Authorization'],
  exposedHeaders: ['sessionId'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));


app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Test Sequelize connection
sequelize.authenticate()
  .then(() => console.log('MySQL connected via Sequelize'))
  .catch(err => console.error('Sequelize connection error:', err));

// Import models to set up associations
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Notification from './models/Notification.js';
import WithdrawalRequest from './models/WithdrawalRequest.js';
import StateSetting from './models/StateSetting.js';
import Currency from './models/Currency.js';
import ExchangeRate from './models/ExchangeRate.js';
import SendMoneyCommissionTier from './models/SendMoneyCommissionTier.js';
import WithdrawalCommissionTier from './models/WithdrawalCommissionTier.js';
import Verification from './models/Verification.js';

// Set up associations
const models = { User, Transaction, Notification, WithdrawalRequest, StateSetting, Currency, ExchangeRate, SendMoneyCommissionTier, WithdrawalCommissionTier, Verification };
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Sync database (create tables)
sequelize.sync()
  .then(() => console.log('Database synchronized'))
  .catch(err => console.error('Database sync error:', err));;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/withdrawals', withdrawalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Socket.io Real-time notifications
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-user', (userId) => {
    console.log(`User ${userId} joining room user-${userId}`);
    socket.join(`user-${userId}`);
    console.log(`User ${userId} successfully joined room user-${userId}`);
  });

  socket.on('send-notification', (data) => {
    io.to(`user-${data.userId}`).emit('new-notification', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Middleware for flash messages
app.use(flash());

// Route for admin verification
app.post('/api/admin/verify', (req, res) => {
  // Assuming verification logic here
  const isVerified = true; // Replace with actual verification logic

  if (isVerified) {
    req.flash('success_msg', 'Admin verified successfully!');
    return res.redirect('/admin/login'); // Redirect to admin login page
  } else {
    req.flash('error_msg', 'Verification failed. Please try again.');
    return res.redirect('/admin/verify'); // Redirect back to verification page
  }
});
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Healthcheck endpoint: http://0.0.0.0:${PORT}/api/health`);
});

export { io };
