import express from 'express';
import Referral from '../model/referral.js';
import { User } from '../model/user.js';

const router = express.Router();

// Save a new referral (optional if already linked during signup)
router.post('/', async (req, res) => {
  const { referrerCode, referredUserId } = req.body;

  try {
    const existing = await Referral.findOne({ referredUserId });
    if (existing) return res.status(400).json({ error: 'Referral already recorded.' });

    const referral = new Referral({ referrerCode, referredUserId });
    await referral.save();

    const referrer = await User.findOne({ referralCode: referrerCode });
    if (referrer) {
      referrer.referrals.push(referredUserId);
      await referrer.save();
    }

    res.status(201).json(referral);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save referral.' });
  }
});

// Redeem referral and credit referrer
router.patch('/redeem', async (req, res) => {
  const { referredUserId } = req.body;

  try {
    const referral = await Referral.findOne({ referredUserId, isRedeemed: false });
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found or already redeemed.' });
    }

    referral.isRedeemed = true;
    await referral.save();

    const referrer = await User.findOne({ referralCode: referral.referrerCode });
    if (referrer) {
      referrer.referralEarnings = (referrer.referralEarnings || 0) + 3;
      await referrer.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to redeem referral.' });
  }
});

// Get individual referral stats by referral code
router.get('/stats/:referralCode', async (req, res) => {
  const { referralCode } = req.params;

  try {
    const referrer = await User.findOne({ referralCode });
    if (!referrer) return res.status(404).json({ error: 'Referrer not found.' });

    res.json({
      name: referrer.name,
      referralCount: referrer.referrals.length || 0,
      referralEarnings: referrer.referralEarnings || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// Get top 10 referrers
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ referralEarnings: { $gt: 0 } })
      .sort({ referralEarnings: -1 })
      .select('name referralEarnings referrals signupDate')
      .limit(10);

    const formatted = users.map(user => ({
      name: user.name,
      referralCount: user.referrals.length,
      referralEarnings: user.referralEarnings,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// Track sharing (optional analytics)
router.post('/share', async (req, res) => {
  try {
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track share.' });
  }
});

// ✅ Get referral code by user ID
router.get('/code/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select('referralCode name');

    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ name: user.name, referralCode: user.referralCode });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch referral code.' });
  }
});

export default router;
