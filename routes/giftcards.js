import express from "express";
import multer from "multer";
import { cloudinaryInstance as cloudinary } from "../app.js";
import { authenticateToken, authenticateAdmin } from "../middleware/auth.js";
import GiftCard from "../model/giftcard.js";
import { Redeem } from "../model/redeem.js";
import { Referral } from "../model/referral.js";
import { User } from "../model/user.js";
import mongoose from "mongoose";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Improved Cloudinary upload helper with better error handling
const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "redeemed_cards",
        resource_type: "auto",
        timeout: 60000 // 60 seconds timeout
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (!result) {
          reject(new Error('Cloudinary upload failed: No result returned'));
        } else {
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

// MongoDB connection check middleware
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
      error: "Service Unavailable",
      message: "Database connection failed",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

// === REDEMPTION ROUTES ===
router.post("/:id/redeem", 
  authenticateToken, 
  checkMongoConnection,
  upload.single("image"), 
  async (req, res) => {
    try {
      // Validate API key if required
      if (process.env.REQUIRE_API_KEY === "true") {
        const apiKey = req.headers["x-api-key"] || req.body.api_key;
        if (!apiKey || apiKey !== process.env.JWT_SECRET) {
          return res.status(401).json({ 
            error: "Authentication failed", 
            message: "Valid API key required" 
          });
        }
      }

      // Validate input
      const { amount } = req.body;
      const { id: giftCardId } = req.params;

      if (!req.file) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Image is required" 
        });
      }

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ 
          error: "Validation error",
          message: "Valid amount is required" 
        });
      }

      // Verify gift card exists with retry logic
      let giftCard;
      try {
        giftCard = await GiftCard.findById(giftCardId).maxTimeMS(10000);
        if (!giftCard) {
          return res.status(404).json({ 
            error: "Not found",
            message: "Gift card not found" 
          });
        }
      } catch (dbError) {
        console.error("Database error when fetching gift card:", dbError);
        return res.status(503).json({ 
          error: "Service Unavailable",
          message: "Database operation failed",
          details: process.env.NODE_ENV === 'development' ? dbError.message : null
        });
      }

      // Upload image to Cloudinary
      let uploadResult;
      try {
        uploadResult = await uploadToCloudinary(req.file.buffer);
        console.log("Cloudinary upload successful:", uploadResult);
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(502).json({ 
          error: "Bad Gateway",
          message: uploadError.message,
          details: process.env.NODE_ENV === 'development' ? uploadError.stack : null
        });
      }

      // Create redemption record with retry logic
      let redemption;
      try {
        redemption = new Redeem({
          userId: req.user._id,
          giftCardId,
          amount: parseFloat(amount),
          imageUrl: uploadResult.secure_url,
          cloudinaryId: uploadResult.public_id,
          status: "pending",
        });

        await redemption.save();
      } catch (saveError) {
        console.error("Failed to save redemption:", saveError);
        // Attempt to delete the uploaded image if saving failed
        try {
          if (uploadResult?.public_id) {
            await cloudinary.uploader.destroy(uploadResult.public_id);
          }
        } catch (cleanupError) {
          console.error("Failed to cleanup Cloudinary image:", cleanupError);
        }

        return res.status(503).json({ 
          error: "Service Unavailable",
          message: "Failed to save redemption",
          details: process.env.NODE_ENV === 'development' ? saveError.message : null
        });
      }

      res.status(201).json({ 
        success: true,
        message: "Redemption submitted successfully",
        data: {
          redemptionId: redemption._id,
          amount: redemption.amount,
          status: redemption.status,
          imageUrl: redemption.imageUrl,
          submittedAt: redemption.createdAt
        }
      });

    } catch (error) {
      console.error("Unexpected redemption error:", error);
      res.status(500).json({ 
        error: "Server error",
        message: "Failed to process redemption",
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : null
      });
    }
  }
);


router.get("/test-token", authenticateToken, (req, res) => {
  res.json({ 
    success: true,
    message: "Token is valid", 
    user: req.user 
  });
});

router.post("/test-upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      error: "Validation error",
      message: "No image uploaded" 
    });
  }

  try {
    const result = await uploadToCloudinary(req.file.buffer);
    res.json({ 
      success: true,
      message: "Image uploaded successfully", 
      result 
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Upload failed",
      message: error.message 
    });
  }
});

// === GIFT CARD ROUTES ===
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, brand, value, currency, image } = req.body;
    if (!name || !brand || !value || !currency || !image) {
      return res.status(400).json({ 
        error: "Validation error",
        message: "All fields are required" 
      });
    }
    
    const giftCard = new GiftCard({ name, brand, value, currency, image });
    await giftCard.save();
    
    res.status(201).json({ 
      success: true,
      message: "Gift card created successfully", 
      data: giftCard 
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Server error",
      message: "Failed to create gift card",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const cards = await GiftCard.find().sort({ createdAt: -1 });
    res.json({ 
      success: true,
      data: cards 
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Server error",
      message: "Failed to fetch gift cards",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const card = await GiftCard.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ 
        error: "Not found",
        message: "Gift card not found" 
      });
    }
    res.json({ 
      success: true,
      data: card 
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Server error",
      message: "Failed to fetch gift card",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// === REDEMPTION ROUTES ===
router.post("/:id/redeem", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    // Validate API key if required
    if (process.env.REQUIRE_API_KEY === "true") {
      const apiKey = req.headers["x-api-key"] || req.body.api_key;
      if (!apiKey || apiKey !== process.env.JWT_SECRET) {
        return res.status(401).json({ 
          error: "Authentication failed", 
          message: "Valid API key required" 
        });
      }
    }

    // Validate input
    const { amount } = req.body;
    const { id: giftCardId } = req.params;

    if (!req.file) {
      return res.status(400).json({ 
        error: "Validation error",
        message: "Image is required" 
      });
    }

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ 
        error: "Validation error",
        message: "Valid amount is required" 
      });
    }

    // Verify gift card exists
    const giftCard = await GiftCard.findById(giftCardId);
    if (!giftCard) {
      return res.status(404).json({ 
        error: "Not found",
        message: "Gift card not found" 
      });
    }

    // Upload image to Cloudinary
    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary(req.file.buffer);
    } catch (error) {
      console.error("Image upload failed:", error);
      return res.status(500).json({ 
        error: "Upload failed",
        message: error.message 
      });
    }

    // Create redemption record
    const redemption = new Redeem({
      userId: req.user._id,
      giftCardId,
      amount: parseFloat(amount),
      imageUrl: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
      status: "pending",
    });

    await redemption.save();

    res.status(201).json({ 
      success: true,
      message: "Redemption submitted successfully",
      data: {
        redemptionId: redemption._id,
        amount: redemption.amount,
        status: redemption.status,
        imageUrl: redemption.imageUrl,
        submittedAt: redemption.createdAt
      }
    });

  } catch (error) {
    console.error("Redemption error:", error);
    res.status(500).json({ 
      error: "Server error",
      message: "Failed to process redemption",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// === ADMIN ROUTES ===
router.post("/redeem/:id/approve", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const redemption = await Redeem.findById(req.params.id);
    if (!redemption) {
      return res.status(404).json({ 
        error: "Not found",
        message: "Redemption not found" 
      });
    }
    
    if (redemption.status !== "pending") {
      return res.status(400).json({ 
        error: "Validation error",
        message: "Redemption already processed" 
      });
    }

    const user = await User.findById(redemption.userId);
    if (!user) {
      return res.status(404).json({ 
        error: "Not found",
        message: "User not found" 
      });
    }

    // Update user balance
    user.balance += parseFloat(redemption.amount);
    await user.save();

    // Update redemption status
    redemption.status = "approved";
    await redemption.save();

    // Handle referral bonus if applicable
    const referral = await Referral.findOne({ referredUser: user._id });
    if (referral && !referral.bonusPaid) {
      const referrer = await User.findById(referral.referrer);
      if (referrer) {
        referrer.balance += parseFloat(process.env.REFERRAL_BONUS || 5);
        await referrer.save();
        referral.bonusPaid = true;
        await referral.save();
      }
    }

    res.status(200).json({ 
      success: true,
      message: "Redemption approved successfully",
      data: redemption
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Server error",
      message: "Failed to approve redemption",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

router.post("/redeem/:id/reject", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const redemption = await Redeem.findById(req.params.id);
    if (!redemption) {
      return res.status(404).json({ 
        error: "Not found",
        message: "Redemption not found" 
      });
    }

    redemption.status = "rejected";
    await redemption.save();

    res.status(200).json({ 
      success: true,
      message: "Redemption rejected successfully",
      data: redemption
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Server error",
      message: "Failed to reject redemption",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

router.get("/redeem", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const redemptions = await Redeem.find()
      .populate("userId")
      .populate("giftCardId")
      .sort({ createdAt: -1 });

    res.json({ 
      success: true,
      data: redemptions 
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Server error",
      message: "Failed to fetch redemptions",
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

export default router;