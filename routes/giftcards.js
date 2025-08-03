import express from "express";
import multer from "multer";
import { cloudinary } from "../app.js";
import { authenticateToken, authenticateAdmin } from "../middleware/auth.js";
import GiftCard from "../model/giftcard.js";
import { Redeem } from "../model/redeem.js";
import { Referral } from "../model/referral.js";
import { User } from "../model/user.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// === CREATE GIFT CARD ===
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, brand, value, currency, image } = req.body;

    if (!name || !brand || !value || !currency || !image) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const giftCard = new GiftCard({ name, brand, value, currency, image });
    await giftCard.save();
    res.status(201).json({ message: "Gift card created successfully", giftCard });
  } catch (error) {
    res.status(500).json({ error: "Failed to create gift card" });
  }
});

// === GET ALL GIFT CARDS ===
router.get("/", async (req, res) => {
  try {
    const cards = await GiftCard.find().sort({ createdAt: -1 });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch gift cards" });
  }
});

// === GET SINGLE GIFT CARD ===
router.get("/:id", async (req, res) => {
  try {
    const card = await GiftCard.findById(req.params.id);
    if (!card) return res.status(404).json({ error: "Gift card not found" });
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch gift card" });
  }
});

// === REDEEM A GIFT CARD ===
router.post("/:id/redeem", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    const { amount } = req.body;
    const { id: giftCardId } = req.params;

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const streamUpload = (buffer) =>
      new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "redeemed_cards" }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }).end(buffer);
      });

    const result = await streamUpload(req.file.buffer);

    const redemption = new Redeem({
      userId: req.user._id,
      giftCardId,
      amount,
      imageUrl: result.secure_url,
      status: "pending",
    });

    await redemption.save();
    res.status(201).json({ message: "Redemption submitted for review", redemption });
  } catch (error) {
    res.status(500).json({ error: "Redemption failed", details: error.message });
  }
});

// === ADMIN: APPROVE REDEMPTION ===
router.post("/redeem/:id/approve", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const redemption = await Redeem.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: "Redemption not found" });
    if (redemption.status !== "pending") return res.status(400).json({ error: "Already processed" });

    const user = await User.findById(redemption.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.balance += parseFloat(redemption.amount);
    await user.save();

    redemption.status = "approved";
    await redemption.save();

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

    res.status(200).json({ message: "Redemption approved and user credited", redemption });
  } catch (error) {
    res.status(500).json({ error: "Approval failed", details: error.message });
  }
});

// === ADMIN: REJECT REDEMPTION ===
router.post("/redeem/:id/reject", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const redemption = await Redeem.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: "Redemption not found" });

    redemption.status = "rejected";
    await redemption.save();

    res.status(200).json({ message: "Redemption rejected", redemption });
  } catch (error) {
    res.status(500).json({ error: "Rejection failed", details: error.message });
  }
});

// === ADMIN: GET ALL REDEMPTIONS ===
router.get("/redeem", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const redemptions = await Redeem.find()
      .populate("userId")
      .populate("giftCardId")
      .sort({ createdAt: -1 });

    res.json(redemptions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch redemptions" });
  }
});

// === TEST ROUTE: FOR DEBUGGING IMAGE UPLOAD ===
router.post("/test-upload", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  res.json({ message: "Image uploaded successfully", filename: req.file.originalname });
});

export default router;
