import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../model/user.js';
import { authenticateAdmin } from '../middlewave/auth.js';

const router = express.Router();

// Admin Login Route
router.post('/', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await User.findOne({ email });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Access denied: Admins only' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const jwtPrivateKey = process.env.JWT_SECRET;
        if (!jwtPrivateKey) {
            return res.status(500).json({ message: "JWT secret is missing from environment variables." });
        }

        const token = jwt.sign(
            { _id: user._id, isAdmin: user.isAdmin }, 
            jwtPrivateKey, 
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

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