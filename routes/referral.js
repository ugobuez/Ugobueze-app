// routes/referral.js
import express from 'express';
import Referral from '../model/referral.js';
import { User } from '../model/user.js';

const router = express.Router();

// Save referral (optional if embedded in user signup)
router.post('/', async (req, res) => {
  const { referrerCode, referredUserId } = req.body;
  try {
    const referral = new Referral({ referrerCode, referredUserId });
    await referral.save();

    // Link referral to referrer user
    const referrer = await User.findOne({ referralCode: referrerCode });
    if (referrer) {
      referrer.referrals.push(referredUserId);
      await referrer.save();
    }

    res.status(201).json(referral);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save referral' });
  }
});

// Redeem referral and add $3
router.patch('/redeem', async (req, res) => {
  const { referredUserId } = req.body;
  try {
    const referral = await Referral.findOne({ referredUserId, isRedeemed: false });
    if (referral) {
      referral.isRedeemed = true;
      await referral.save();

      const referrer = await User.findOne({ referralCode: referral.referrerCode });
      if (referrer) {
        referrer.referralEarnings = (referrer.referralEarnings || 0) + 3;
        await referrer.save();
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to redeem referral' });
  }
});

// ✅ Get individual referral stats
router.get('/stats/:referralCode', async (req, res) => {
  const { referralCode } = req.params;
  try {
    const referrer = await User.findOne({ referralCode });
    if (!referrer) return res.status(404).json({ message: 'Referrer not found' });

    const count = Array.isArray(referrer.referrals) ? referrer.referrals.length : 0;
    const earnings = referrer.referralEarnings || 0;

    res.json({ count, earnings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ✅ Leaderboard - Top users by earnings
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ referralEarnings: { $gt: 0 } })
      .sort({ referralEarnings: -1 })
      .select('name email referralEarnings signupDate')
      .limit(10);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Optional: Track share attempt
router.post('/share', async (req, res) => {
  const { userId } = req.body;
  try {
    // Log or increment share count here if needed
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track share' });
  }
});

export default router;
