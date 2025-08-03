import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import { Redeem } from '../model/redeem.js';
import { User } from '../model/user.js';
import { Referral } from '../model/referral.js';
import GiftCard from '../model/giftcard.js';

const router = express.Router();

// Multer config for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /api/redeem — submit a redemption
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { amount, giftCardId } = req.body;

    if (!req.file) return res.status(400).json({ error: 'Image is required' });
    if (!giftCardId) return res.status(400).json({ error: 'giftCardId is required' });

    if (!mongoose.Types.ObjectId.isValid(giftCardId)) {
      return res.status(400).json({ error: 'Invalid giftCardId' });
    }

    const giftCardExists = await GiftCard.findById(giftCardId);
    if (!giftCardExists) {
      return res.status(404).json({ error: 'Gift card not found' });
    }

    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload();

    const redeem = new Redeem({
      userId: req.user._id,
      giftCardId,
      amount: Number(amount) || 0,
      imageUrl: result.secure_url,
    });

    await redeem.save();
    res.status(201).json({ message: 'Gift card submitted for review', redeem });
  } catch (error) {
    console.error('Error submitting redemption:', error);
    res.status(500).json({ error: 'Failed to submit gift card' });
  }
});

// POST /api/redeem/:id/approve — approve a redemption
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid redemption ID' });
    }

    const redeem = await Redeem.findById(id);
    if (!redeem) return res.status(404).json({ error: 'Redemption not found' });

    redeem.status = 'approved';
    await redeem.save();

    const user = await User.findById(redeem.userId);
    if (user) {
      user.balance += redeem.amount;
      await user.save();
    }

    const REFERRAL_BONUS = Number(process.env.REFERRAL_BONUS) || 3;

    if (user.referredBy) {
      const referral = await Referral.findOne({
        referrerCode: user.referredBy,
        referredUserId: user._id.toString(),
        isRedeemed: false,
      });

      if (referral) {
        referral.totalApprovedAmount = (referral.totalApprovedAmount || 0) + redeem.amount;

        if (referral.totalApprovedAmount >= 100 && !referral.isRedeemed) {
          referral.isRedeemed = true;
          const referrer = await User.findOne({ referralCode: user.referredBy });

          if (referrer) {
            referrer.referralEarnings += REFERRAL_BONUS;
            await referrer.save();
          }
        }

        await referral.save();
      }
    }

    res.json({ message: 'Redemption approved', redeem });
  } catch (error) {
    console.error('Error approving redemption:', error);
    res.status(500).json({ error: 'Failed to approve redemption' });
  }
});

// POST /api/redeem/:id/reject — reject a redemption
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid redemption ID' });
    }

    const redeem = await Redeem.findById(id);
    if (!redeem) return res.status(404).json({ error: 'Redemption not found' });

    redeem.status = 'rejected';
    await redeem.save();

    res.json({ message: 'Redemption rejected', redeem });
  } catch (error) {
    console.error('Error rejecting redemption:', error);
    res.status(500).json({ error: 'Failed to reject redemption' });
  }
});

// GET /api/redeem — list all redemptions
router.get('/', async (req, res) => {
  try {
    const redemptions = await Redeem.find().sort({ createdAt: -1 });
    res.json(redemptions);
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    res.status(500).json({ error: 'Failed to fetch redemptions' });
  }
});

export default router;
