import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import Redemption from "../model/redeem.js";
import GiftCard from "../model/giftcard.js";
import User from "../model/user.js";
import Referral from "../model/referral.js";
import authMiddleware from "../middlewave/auth.js";

const router = express.Router();
const REFERRAL_BONUS = Number(process.env.REFERRAL_BONUS || 3);

// Configure Multer (for in-memory file uploads)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Submit a redemption request with image upload
router.post("/", authMiddleware(), upload.single("image"), async (req, res) => {
  try {
    const { giftCardId, amount } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Image is required" });
    }

    const giftCard = await GiftCard.findById(giftCardId);
    if (!giftCard) return res.status(404).json({ error: "Gift card not found" });

    // Upload image to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "image", folder: "giftcards" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const imageUrl = uploadResult.secure_url;

    const redemption = new Redemption({
      userId: req.user.userId,
      giftCardId,
      imageUrl,
      amount: amount || giftCard.amount || 0,
    });

    await redemption.save();
    res.status(201).json({ message: "Redemption request submitted" });
  } catch (err) {
    console.error("Redeem error:", err);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

// Admin approves redemption and gives referral bonus
router.put("/:id/approve", authMiddleware("admin"), async (req, res) => {
  try {
    const redemption = await Redemption.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: "Redemption not found" });

    if (redemption.status === "approved") {
      return res.status(400).json({ message: "Redemption already approved" });
    }

    const giftCard = await GiftCard.findById(redemption.giftCardId);
    const amount = giftCard?.amount || redemption.amount || 0;

    const user = await User.findById(redemption.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    redemption.status = "approved";
    await redemption.save();

    user.balance += amount;
    await user.save();

    // Apply referral bonus if not yet redeemed
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

    res.json({ message: "Redemption approved and balance updated" });
  } catch (err) {
    console.error("Error approving redemption:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin rejects redemption
router.put("/:id/reject", authMiddleware("admin"), async (req, res) => {
  try {
    await Redemption.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.json({ message: "Redemption rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
