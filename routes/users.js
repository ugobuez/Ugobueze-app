import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, validateUser } from '../model/user.js';
import { authenticateToken, authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// ✅ Health check
router.get('/', (req, res) => {
  res.send('User signup endpoint is live. Use POST to register.');
});

// ✅ Register new user with optional referral code
router.post('/', async (req, res) => {
  const { error } = validateUser(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const { name, email, password, phone, referredBy } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).send('User already registered.');

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = new User({ name, email, password: hashedPassword, phone, referredBy });

  try {
    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.referrals.push(user._id);
        referrer.referralEarnings += 3;
        referrer.balance += 3;
        await referrer.save();
      }
    }

    await user.save();
    const token = user.generateAuthToken();
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      token,
    });
  } catch (err) {
    res.status(500).send('Error creating user: ' + err.message);
  }
});

// ✅ Admin login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Admins only' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid email or password' });

    const token = jwt.sign(
      { _id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Regular user login (optional, not just admin)
router.post('/login-user', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const token = user.generateAuthToken();
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Get current logged-in user info (used by Dashboard)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      name: user.name,
      email: user.email,
      balance: user.balance || 0,
      referralCode: user.referralCode || '',
      referredCount: user.referrals?.length || 0,
      isAdmin: user.isAdmin || false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Get users referred by the logged-in user
router.get('/referrals', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.referralCode) return res.status(404).json({ error: 'User or referral code not found' });

    const referredUsers = await User.find({ referredBy: user.referralCode }).select('_id name email signupDate');
    res.json(referredUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// ✅ Leaderboard of top referrers
router.get('/referrals/leaderboard', async (req, res) => {
  try {
    const leaderboard = await User.find({ referralEarnings: { $gt: 0 } })
      .sort({ referralEarnings: -1 })
      .limit(10)
      .select('name referralEarnings referrals');

    const formatted = leaderboard.map(user => ({
      name: user.name,
      referralCount: user.referrals.length,
      referralEarnings: user.referralEarnings,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ✅ Stats by referral code (public view)
router.get('/referrals/stats/:referralCode', async (req, res) => {
  try {
    const user = await User.findOne({ referralCode: req.params.referralCode }).select('name referrals referralEarnings');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      name: user.name,
      referralCount: user.referrals.length,
      referralEarnings: user.referralEarnings,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ✅ Admin dashboard route (protected)
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
