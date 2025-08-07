import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../model/user.js';
import { authenticateAdmin } from '../middlewave/auth.js';

const router = express.Router();


// Admin Protected Route Example
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        const admins = await User.find({ isAdmin: true }).select('-password');
        res.json(admins);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;