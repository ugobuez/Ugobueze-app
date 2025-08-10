import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js'; // Use authenticateAdmin for admin routes

import dotenv from 'dotenv'; // For environment variables

dotenv.config(); // Load environment variables from .env file

const router = express.Router();



// GET /api/activities/dashboard - Fetch all admins (admin-only)
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const admins = await User.find({ isAdmin: true }).select('-password');
    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error.message);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

export default router;