import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateToken, authenticateAdmin } from '../middleware/auth.js';
import GiftCard from '../model/giftcard.js';
import { Redeem } from '../model/redeem.js';
import { Referral } from '../model/referral.js';
import { User } from '../model/user.js';
import mongoose from 'mongoose';

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

// Cloudinary upload helper
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'gift_cards', resource_type: 'auto', timeout: 60000 }, // Updated folder name
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

// Test token endpoint
router.get('/test-token', authenticateToken, (req, res) => {
  console.log('Test-token route hit:', { userId: req.user._id });
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
    res.json({ success: true, data: redemptions });
  } catch (error) {
    console.error('Fetch redemptions error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch redemptions',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  }
});

// Redeem gift card
router.post('/:id/redeem', authenticateToken, checkMongoConnection, upload.single('image'), async (req, res) => {
  try {
    console.log('Redeem request received:', {
      headers: req.headers,
      body: req.body,
      user: req.user,
      file: req.file?.originalname,
    });

    if (process.env.REQUIRE_API_KEY === 'true') {
      const apiKey = req.headers['x-api-key'] || req.body.api_key;
      if (!apiKey || apiKey !== process.env.JWT_SECRET) {
        console.error('Invalid API key:', { provided: apiKey });
        return res.status(401).json({ error: 'Authentication failed', message: 'Valid API key required' });
      }
    }

    const { amount } = req.body;
    const { id: giftCardId } = req.params;

    if (!req.file) return res.status(400).json({ error: 'Validation error', message: 'Image is required' });
    if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: 'Validation error', message: 'Valid amount is required' });

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
      userId: req.user._id,
      giftCardId,
      amount: parseFloat(amount),
      imageUrl: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
      status: 'pending',
    });

    await redemption.save();

    res.status(201).json({
      success: true,
      message: 'Redemption submitted successfully',
      data: {
        redemptionId: redemption._id,
        amount: redemption.amount,
        status: redemption.status,
        imageUrl: redemption.imageUrl,
        submittedAt: redemption.createdAt,
      },
    });
  } catch (error) {
    console.error('Redemption error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to process redemption',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  }
});

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

    res.status(200).json({ success: true, message: 'Redemption approved successfully', data: redemption });
  } catch (error) {
    console.error('Approve redemption error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to approve redemption',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  }
});

// Reject redemption (admin)
router.post('/redeem/:id/reject', authenticateToken, authenticateAdmin, checkMongoConnection, async (req, res) => {
  try {
    const redemption = await Redeem.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: 'Not found', message: 'Redemption not found' });

    redemption.status = 'rejected';
    await redemption.save();

    res.status(200).json({ success: true, message: 'Redemption rejected successfully', data: redemption });
  } catch (error) {
    console.error('Reject redemption error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to reject redemption',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
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
  } catch (error) {
    console.error('Create gift card error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to create gift card',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
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
  } catch (error) {
    console.error('Delete gift card error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to delete gift card',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  }
});

// Get all gift cards (admin only)
router.get('/', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const cards = await GiftCard.find().sort({ createdAt: -1 });
    res.json({ success: true, data: cards });
  } catch (error) {
    console.error('Fetch gift cards error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch gift cards',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  }
});

// Get single gift card
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const card = await GiftCard.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found', message: 'Gift card not found' });
    res.json({ success: true, data: card });
  } catch (error) {
    console.error('Fetch gift card error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch gift card',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  }
});

export default router;