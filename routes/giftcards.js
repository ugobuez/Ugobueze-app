import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateToken, authenticateAdmin } from '../middleware/auth.js';
import GiftCard from '../model/giftcard.js';
import { Redeem } from '../model/redeem.js';
import { Referral } from '../model/referral.js';
import { User } from '../model/user.js';
import mongoose from 'mongoose';
import Joi from 'joi'; // Ensure Joi is imported
import logActivity from '../utils/logActivity.js';

const router = express.Router();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// Joi validation schema for redemption submission
const validateRedemption = (data) => {
  const schema = Joi.object({
    amount: Joi.number().positive().min(1).required(),
  });
  return schema.validate(data);
};

// Cloudinary upload helper
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'gift_cards', resource_type: 'auto', timeout: 60000 },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (!result) {
          reject(new Error('Cloudinary upload failed: No result returned'));
        } else {
          console.log('Cloudinary upload successful:', result);
          resolve(result);
        }
      }
    );
    uploadStream.on('error', (error) => {
      console.error('Cloudinary stream error:', error);
      reject(new Error(`Cloudinary stream error: ${error.message}`));
    });
    uploadStream.end(fileBuffer);
  });
};

// MongoDB connection check
const checkMongoConnection = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB connection lost, attempting to reconnect...');
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('MongoDB reconnected successfully');
    }
    next();
  } catch (error) {
    console.error('MongoDB reconnection failed:', error);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database connection failed',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  }
};

// Updated submitRedeem function
export const submitRedeem = async (req, res) => {
  const { error } = validateRedemption(req.body);
  if (error) {
    console.log(`Validation error in submitRedeem: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log(`User not found for ID: ${req.user.id}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const { amount } = req.body;
    const { id: giftCardId } = req.params;

    if (!req.file) return res.status(400).json({ error: 'Validation error', message: 'Image is required' });
    const giftCard = await GiftCard.findById(giftCardId).maxTimeMS(10000);
    if (!giftCard) return res.status(404).json({ error: 'Not found', message: 'Gift card not found' });

    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary(req.file.buffer);
    } catch (error) {
      console.error('Image upload failed:', error);
      return res.status(502).json({ error: 'Bad Gateway', message: error.message });
    }

    const redemption = new Redeem({
      userId: req.user.id,
      giftCardId,
      amount: parseFloat(amount),
      imageUrl: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
      status: 'pending',
    });

    await redemption.save();

    // Log activity for submission
    await logActivity({
      userId: req.user.id,
      type: 'redemption',
      title: 'Gift Card Redemption Submitted',
      description: `You submitted a ${giftCard.name || 'gift card'} redemption for $${amount}.`,
    });

    console.log(`Redemption request submitted for user ${req.user.id}: $${amount}`);
    res.status(200).json({
      message: 'Redemption submitted successfully',
      redemptionId: redemption._id,
      status: redemption.status,
      submittedAt: redemption.createdAt,
    });
  } catch (err) {
    console.error('Redemption error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

// Test token endpoint
router.get('/test-token', authenticateToken, (req, res) => {
  console.log('Test-token route hit:', { userId: req.user.id });
  res.json({ success: true, message: 'Token is valid', user: req.user });
});

// Test image upload endpoint
router.post('/test-upload', authenticateToken, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Validation error', message: 'No image uploaded' });
  try {
    const result = await uploadToCloudinary(req.file.buffer);
    res.json({ success: true, message: 'Image uploaded successfully', result });
  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

// Get all redemptions (admin)
router.get('/redeem', authenticateToken, authenticateAdmin, checkMongoConnection, async (req, res) => {
  try {
    const redemptions = await Redeem.find()
      .populate('userId', 'name email')
      .populate('giftCardId', 'name brand value currency')
      .sort({ createdAt: -1 });
    console.log(`Fetched ${redemptions.length} redemptions`);
    res.status(200).json({ success: true, data: redemptions });
  } catch (err) {
    console.error('Error fetching redemptions:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Redeem gift card
router.post('/:id/redeem', authenticateToken, checkMongoConnection, upload.single('image'), submitRedeem);

// Approve redemption (admin)
router.post('/redeem/:id/approve', authenticateToken, authenticateAdmin, checkMongoConnection, async (req, res) => {
  try {
    const redemption = await Redeem.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: 'Not found', message: 'Redemption not found' });
    if (redemption.status !== 'pending') return res.status(400).json({ error: 'Validation error', message: 'Redemption already processed' });

    const user = await User.findById(redemption.userId);
    if (!user) return res.status(404).json({ error: 'Not found', message: 'User not found' });

    user.balance += parseFloat(redemption.amount);
    await user.save();

    redemption.status = 'approved';
    await redemption.save();

    const giftCard = await GiftCard.findById(redemption.giftCardId);
    await logActivity({
      userId: user._id,
      type: 'redemption',
      title: 'Gift Card Redemption Approved',
      description: `Your ${giftCard.name || 'gift card'} redemption of $${redemption.amount} was approved.`,
    });

    const referral = await Referral.findOne({ referredUser: user._id });
    if (referral && !referral.bonusPaid) {
      const referrer = await User.findById(referral.referrer);
      if (referrer) {
        referrer.balance += parseFloat(process.env.REFERRAL_BONUS || 3);
        await referrer.save();
        referral.bonusPaid = true;
        await referral.save();
      }
    }

    console.log(`Redemption ${redemption._id} approved for user ${user._id}`);
    res.status(200).json({ success: true, message: 'Redemption approved successfully', data: redemption });
  } catch (err) {
    console.error('Approve redemption error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Reject redemption (admin)
router.post('/redeem/:id/reject', authenticateToken, authenticateAdmin, checkMongoConnection, async (req, res) => {
  try {
    const redemption = await Redeem.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: 'Not found', message: 'Redemption not found' });

    redemption.status = 'rejected';
    await redemption.save();

    const giftCard = await GiftCard.findById(redemption.giftCardId);
    await logActivity({
      userId: redemption.userId,
      type: 'redemption',
      title: 'Gift Card Redemption Rejected',
      description: `Your ${giftCard.name || 'gift card'} redemption of $${redemption.amount} was rejected.`,
    });

    console.log(`Redemption ${redemption._id} rejected`);
    res.status(200).json({ success: true, message: 'Redemption rejected successfully', data: redemption });
  } catch (err) {
    console.error('Reject redemption error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Create gift card with file upload
router.post('/', authenticateToken, authenticateAdmin, checkMongoConnection, upload.single('image'), async (req, res) => {
  try {
    const { name, brand, value, currency } = req.body;
    if (!name || !brand || !value || !currency) {
      return res.status(400).json({ error: 'Validation error', message: 'All fields are required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Validation error', message: 'Image is required' });
    }

    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary(req.file.buffer);
    } catch (error) {
      console.error('Image upload failed:', error);
      return res.status(502).json({ error: 'Bad Gateway', message: error.message });
    }

    const giftCard = new GiftCard({
      name,
      brand,
      value: parseFloat(value),
      currency,
      image: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
    });
    await giftCard.save();
 
    res.status(201).json({ success: true, message: 'Gift card created successfully', data: giftCard });
  } catch (err) {
    console.error('Create gift card error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Delete gift card (with Cloudinary cleanup)
router.delete('/:id', authenticateToken, authenticateAdmin, checkMongoConnection, async (req, res) => {
  try {
    const card = await GiftCard.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ error: 'Not found', message: 'Gift card not found' });
    }

    if (card.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(card.cloudinaryId);
      } catch (error) {
        console.error('Failed to delete image from Cloudinary:', error);
      }
    }

    await card.deleteOne();
    res.json({ success: true, message: 'Gift card deleted successfully' });
  } catch (err) {
    console.error('Delete gift card error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get all gift cards (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cards = await GiftCard.find().sort({ createdAt: -1 });
    res.json({ success: true, data: cards });
  } catch (err) {
    console.error('Fetch gift cards error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get single gift card
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const card = await GiftCard.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found', message: 'Gift card not found' });
    res.json({ success: true, data: card });
  } catch (err) {
    console.error('Fetch gift card error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

export default router;