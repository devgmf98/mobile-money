import express from 'express';
import { bootstrapAdmin } from './utils/bootstrapAdmin.js';
import sequelize from './config/database.js';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { setIO } from './utils/socket.js';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import helpRoutes from './routes/helpRoutes.js';
import { seedHelpArticles } from './controllers/helpController.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const flash = require('connect-flash');

const app = express();
const httpServer = createServer(app);

// Allow both common frontend ports for development (5173, 5174)
// and also read from FRONTEND_URL, API_URL, and API_PRODUCTION_URL env vars if set
const allowedOrigins = [
  'http://zainss.dpdns.org',
  'http://localhost:5173',
  'http://localhost:5174',
  /* The frontend is on Netlify and the API on Railway, so every browser call
     is cross-origin — without this the deployed app cannot reach the API at
     all. Hardcoded so CORS holds even when FRONTEND_URL is unset. */
  'https://gpay-ss.netlify.app',
  /* The Railway service itself, which also serves a copy of the built
     frontend from the same origin. */
  'https://mobile-money-production-b493.up.railway.app'
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


app.use(express.json({ 
  limit: '100mb',
  parameterLimit: 50000
}));
app.use(express.urlencoded({ 
  limit: '100mb', 
  extended: true,
  parameterLimit: 50000
}));

// Import models to set up associations
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Notification from './models/Notification.js';
import DeviceToken from './models/DeviceToken.js';
import WithdrawalRequest from './models/WithdrawalRequest.js';
import StateSetting from './models/StateSetting.js';
import Currency from './models/Currency.js';
import ExchangeRate from './models/ExchangeRate.js';
import SendMoneyCommissionTier from './models/SendMoneyCommissionTier.js';
import WithdrawalCommissionTier from './models/WithdrawalCommissionTier.js';
import Verification from './models/Verification.js';
import ContactMessage from './models/ContactMessage.js';
import HelpArticle from './models/HelpArticle.js';
import { migrateStateToName, ensureColumns } from './migrations/stateToName.js';
import { widenColumns } from './migrations/widenColumns.js';

// Set up associations
const models = { User, Transaction, Notification, DeviceToken, WithdrawalRequest, StateSetting, Currency, ExchangeRate, SendMoneyCommissionTier, WithdrawalCommissionTier, Verification, ContactMessage, HelpArticle };
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/help', helpRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

/* Socket.io real-time notifications.

   Rooms are named for a user id and carry that person's balance and their
   notifications -- amounts, counterparty numbers, the lot. The room was joined
   from whatever id the client asked for, with no token checked, so anyone who
   knew this URL could subscribe to any account by counting upwards. The
   identity now comes from the JWT and the client's own claim is ignored.

   The handshake reads `auth.token`, which every socket.io client can set, and
   falls back to the query string for older ones. A connection with no valid
   token is still accepted -- it simply joins nothing and receives nothing, so
   an app that has not been updated degrades to pull-to-refresh rather than
   failing to connect. */
io.use((socket, next) => {
  const raw =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.authorization?.split(' ')[1];

  if (raw) {
    try {
      const decoded = jwt.verify(raw, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
    } catch {
      /* An expired or forged token is treated as none at all. */
    }
  }
  next();
});

io.on('connection', (socket) => {
  socket.on('join-user', () => {
    /* The id the client sent is deliberately not read. Whoever the token says
       they are is the only room they may listen to. */
    if (!socket.userId) {
      console.warn('Unauthenticated socket asked to join a room - refused');
      return;
    }
    socket.join(`user-${socket.userId}`);
  });

  /* `send-notification` used to relay any payload to any room, so an
     unauthenticated client could push a convincing "Money Received" to
     someone. Nothing legitimate used it -- every real notification is emitted
     server-side from the controller that moved the money -- so it is gone
     rather than secured. */

  socket.on('disconnect', () => {});
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

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected via Sequelize');

    /* Schema changes sync() cannot make for itself, run before it does. The
       destination column had to change type while a foreign key still held
       it, which sync() cannot do — it fails and takes the process down with
       it, so a deployment would answer 502 until someone ran a script by
       hand. Doing it here means a deploy repairs itself. */
    try {
      const result = await migrateStateToName(sequelize);
      if (result.changed) console.log('Migration (destination column): ' + result.changed.join('; '));

      const added = await ensureColumns(sequelize);
      if (added.length) console.log('Migration (columns added): ' + added.join(', '));

      /* Types that are too narrow for what the app stores. Ahead of sync()
         for the same reason as the rest: sync() cannot reliably change a
         column type, and when it cannot, it says nothing. */
      const widened = await widenColumns(sequelize);
      if (widened.length) console.log('Migration (columns widened): ' + widened.join('; '));
    } catch (err) {
      /* Reported, not swallowed: sync() is about to fail for the same reason,
         and this line is what explains why. */
      console.error('Migration (destination column) failed:', err.message);
    }

    // Create missing tables and add missing model columns on every startup.
    // Sequelize alter preserves existing rows while bringing the schema up to date.
    await sequelize.sync({ alter: true });
    console.log('Database synchronized and schema updated');

    /* The Help Center opens on whatever is in the table, so an empty one would
       greet the first customer with an apology. Seeded once, only when there is
       nothing there — it never overwrites what staff have written. */
    try {
      const help = await seedHelpArticles();
      if (help.seeded) console.log(`Help Center seeded with ${help.seeded} starter articles`);
    } catch (err) {
      /* Same rule as the admin bootstrap below: seeding must never be the
         reason the API fails to come up. */
      console.error('Help Center seeding failed:', err.message);
    }

    /* A fresh deployment has tables but no accounts, so nobody can sign in and
       nothing can create the first admin. Seed one from the environment. */
    try {
      const result = await bootstrapAdmin();
      if (result.created) {
        console.log(`Default admin created: ${result.email} (adminId ${result.adminId})`);
      } else {
        console.log(`Default admin not created — ${result.reason}`);
      }
    } catch (err) {
      /* Never block startup on seeding: a running API with no admin is still
         more useful than a container that will not boot. */
      console.error('Admin bootstrap failed:', err.message);
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Healthcheck endpoint: http://0.0.0.0:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Database startup error:', error);
    process.exitCode = 1;
  }
}

startServer();

export { io };
