import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import authRoute from './routes/auth.js';
import giftCardRoutes from "./routes/giftcards.js";
import userRoute from './routes/users.js';
import adminRoutes from "./routes/admin.js";
import referralRoutes from './routes/referral.js';

import 'dotenv/config';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

const app = express();

// ✅ Only use one cors() config (remove duplicate above)
app.use(cors({
    origin: [
        "http://localhost:3000", 
        "https://ugobueze-web.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(express.json());

app.use('/api/user', userRoute);
app.use('/api/auth', authRoute);
app.use("/api/giftcards", giftCardRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/referrals', referralRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong! Please try again later');
});

const port = process.env.PORT || 4500;
app.listen(port, () => console.log(`Listening on port ${port}`));
