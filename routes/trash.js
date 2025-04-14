import express from 'express';
import _ from 'lodash';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, validateUser } from '../model/user.js';
import { getUserDetails } from '../controller.js/userController.js';
import { authenticateToken } from '../middlewave/auth.js';

const router = express.Router();

router.post('/', async (req, res) => {
    const { error } = validateUser(req.body);
    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    let user = await User.findOne({ email: req.body.email });
    if (user) {
        return res.status(400).send('User already registered.');
    }

    user = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        isAdmin: req.body.isAdmin === "true" || req.body.isAdmin === true // ✅ Convert string "true" to boolean
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    try {
        await user.save();
    } catch (err) {
        return res.status(500).send('Error creating user: ' + err.message);
    }

    const jwtPrivateKey = process.env.JWT_SECRET;
    if (!jwtPrivateKey) {
        return res.status(500).json({ message: "JWT secret is missing from environment variables." });
    }

    const payload = {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin // ✅ Include isAdmin in token
    };

    const token = jwt.sign(payload, jwtPrivateKey, { expiresIn: '1h' });
    
    res.send({ ..._.pick(user, ['_id', 'name', 'email', 'isAdmin']), token });
});


router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) return res.status(404).send('User not found');
        res.send(user);
    } catch (err) {
        res.status(500).send('Server error: ' + err.message);
    }
});

export default router;
