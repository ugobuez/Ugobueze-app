import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import authRouter from './routes/auth.js';
import redemptionRouter from './routes/redemptions.js';
import referralRouter from './routes/referral.js';
import giftCardRouter from './routes/giftcards.js';
import userRouter from './routes/users.js';
import withdrawalRouter from './routes/withdrawal.js';
import activity from './routes/activity.js';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const app = express();
const port = process.env.PORT || 4500;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://ugobueze-web.vercel.app', 'https://ugobueze-app.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', redemptionRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/giftcards', giftCardRouter);
app.use('/api/users', userRouter);
app.use('/api/admin/withdrawals', withdrawalRouter);
app.use('/api/activities', activity);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      cloudinary: 'configured',
    },
  });
});

// Referral redirection
app.get('/signup', (req, res) => {
  const { code } = req.query;
  return res.redirect(`https://ugobueze-web.vercel.app/signup?code=${code}`);
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
  w: 'majority',
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Log registered routes
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`Registered route: ${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
  } else if (r.name === 'router' && r.regexp) {
    // Log nested routes from routers
    r.handle.stack.forEach((handler) => {
      if (handler.route && handler.route.path) {
        console.log(`Registered nested route: ${Object.keys(handler.route.methods).join(',')} /api${handler.route.path}`);
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({
    error: 'Server error',
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : null,
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});