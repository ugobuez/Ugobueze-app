import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors'; // Import cors
import authRoute from './routes/auth.js';
import giftCardRoutes from "./routes/giftcards.js";
import userRoute from './routes/users.js';
import adminRoutes from "./routes/admin.js";
import 'dotenv/config';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));


const app = express();
app.use(cors());
// Enable CORS
app.use(cors({
    origin: "http://localhost:3000", // Allow requests from frontend
    credentials: true // Allow cookies/auth headers
}));

app.use(express.json());

app.use('/api/user', userRoute);
app.use('/api/auth', authRoute);
app.use("/api/giftcards", giftCardRoutes);
app.use("/api/admin", adminRoutes);




app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong! Please try again later');
});


const port = process.env.PORT || 3500;
app.listen(port, () => console.log(`Listening on port ${port}`));
