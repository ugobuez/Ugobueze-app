import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { User } from '../model/user.js';
import { Redeem } from '../model/redeem.js';
import GiftCard from '../model/giftcard.js';
import { Referral } from '../model/referral.js';
import { authenticateToken, authenticateAdmin } from '../middleware/auth.js';
import logActivity from '../utils/logActivity.js';

const router = express.Router();
const REFERRAL_BONUS = Number(process.env.REFERRAL_BONUS || 3);

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------- APPROVE REDEMPTION -------------------
router.post('/redemptions/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid redemption ID' });
    }

    const redemption = await Redeem.findById(id);
    if (!redemption) {
      return res.status(404).json({ error: 'Redemption not found' });
    }

    if (redemption.status === 'approved') {
      return res.status(400).json({ error: 'Redemption already approved' });
    }

    const user = await User.findById(redemption.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const giftCard = await GiftCard.findById(redemption.giftCardId);
    const amount = giftCard?.amount || redemption.amount || 0;

    // Approve redemption and update user balance
    redemption.status = 'approved';
    await redemption.save();

    user.balance += amount;
    await user.save();

    // Log activity for approval
    await logActivity({
      userId: redemption.userId,
      type: 'redemption',
      title: 'Gift Card Redemption Approved',
      description: `Your ${redemption.brand} gift card redemption of $${amount} was approved.`,
    });

    // Handle referral earnings
    if (user.referredBy) {
      const referral = await Referral.findOne({
        referrerCode: user.referredBy,
        referredUserId: user._id.toString(),
        isRedeemed: false,
      });

      if (referral) {
        referral.isRedeemed = true;
        await referral.save();

        const referrer = await User.findOne({ referralCode: user.referredBy });
        if (referrer) {
          referrer.referralEarnings += REFERRAL_BONUS;
          await referrer.save();
        }
      }
    }

    res.json({ message: 'Redemption approved successfully', balance: user.balance });
  } catch (err) {
    console.error('Approve redemption error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ------------------- REJECT REDEMPTION -------------------
router.post('/redemptions/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid redemption ID' });
    }

    const redemption = await Redeem.findById(id);
    if (!redemption) {
      return res.status(404).json({ error: 'Redemption not found' });
    }

    if (redemption.status === 'rejected') {
      return res.status(400).json({ error: 'Redemption already rejected' });
    }

    redemption.status = 'rejected';
    redemption.reason = reason || 'No reason provided';
    await redemption.save();

    // Log activity for rejection
    await logActivity({
      userId: redemption.userId,
      type: 'redemption',
      title: 'Gift Card Redemption Rejected',
      description: `Your ${redemption.brand} gift card redemption of $${redemption.amount} was rejected. Reason: ${reason || 'No reason provided'}.`,
    });

    res.json({ message: 'Redemption rejected successfully' });
  } catch (err) {
    console.error('Reject redemption error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ------------------- GET ALL REDEMPTIONS -------------------
router.get('/redemptions', authenticateAdmin, async (req, res) => {
  try {
    console.log('Fetching redemptions for user:', req.user);
    const redemptions = await Redeem.find()
      .populate('userId', 'name email')
      .populate('giftCardId', 'brand name value currency')
      .sort({ createdAt: -1 });
    res.json(redemptions);
  } catch (err) {
    console.error('Error fetching redemptions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;