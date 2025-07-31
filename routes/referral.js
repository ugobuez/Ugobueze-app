import express from 'express';
import Referral from '../model/referral.js';
import User from '../model/user.js'; 

const router = express.Router();

// Save referral
router.post('/', async (req, res) => {
  const { referrerCode, referredUserId } = req.body;
  try {
    const referral = new Referral({ referrerCode, referredUserId });
    await referral.save();
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

// Get referral stats
router.get('/stats/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const referrals = await Referral.find({ referrerCode: userId, isRedeemed: true });
    const count = referrals.length;
    const earnings = count * 3; // $3 per referral
    res.json({ count, earnings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Track share attempt (optional)
router.post('/share', async (req, res) => {
  const { userId } = req.body;
  try {
    // Add logic to track share (e.g., increment a share count)
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track share' });
  }
});

export default router;