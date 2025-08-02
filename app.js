import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Import Routes
import authRoute from './routes/auth.js';
import giftCardRoutes from './routes/giftcards.js';
import userRoute from './routes/users.js';
import adminRoutes from './routes/admin.js';
import referralRoutes from './routes/referral.js';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/user', userRoute);
app.use('/api/auth', authRoute);
app.use('/api/giftcards', giftCardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referrals', referralRoutes);

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
