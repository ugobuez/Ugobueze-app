// app.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cloudinary from 'cloudinary';

// Load environment variables
dotenv.config({ path: '/Users/apple/Desktop/ugobtc-api/.env' });
console.log('Environment variables:', {
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '[REDACTED]' : undefined,
  REFERRAL_BONUS: process.env.REFERRAL_BONUS,
});

// Cloudinary config
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('Cloudinary configured globally');

// Import Routes
import authRoute from './routes/auth.js';
import giftCardRoutes from './routes/giftcards.js';
import userRoute from './routes/users.js';
import adminRoutes from './routes/admin.js';
import referralRoute from './routes/referral.js';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Initialize Express App
const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://ugobueze-web.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/users', userRoute);
app.use('/api/auth', authRoute);
app.use('/api/giftcards', giftCardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referrals', referralRoute);

// Health check route
app.get('/api', (req, res) => {
  res.status(200).json({ message: 'API is working' });
});

// Fallback for unknown routes
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Something went wrong! Please try again later.' });
});

// Start Server
const PORT = process.env.PORT || 4500;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Export cloudinary for use in routes
export { cloudinary };
