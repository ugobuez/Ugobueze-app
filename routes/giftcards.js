import express from "express";
import GiftCard from "../model/giftcard.js";
import { authenticateToken, authenticateAdmin } from "../middlewave/auth.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import streamifier from "streamifier";
import { Redemption } from "../model/redeem.js";

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit to 5MB
});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// 🟢 Get all gift cards
router.get("/", async (req, res) => {
  try {
    const giftCards = await GiftCard.find();
    res.json(giftCards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 Get a single gift card by ID
router.get("/:id", async (req, res) => {
  try {
    const giftCard = await GiftCard.findById(req.params.id);
    if (!giftCard) return res.status(404).json({ error: "Gift card not found" });
    res.json(giftCard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔴 Create a new gift card (Admin Only)
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { name, brand, value, currency, image } = req.body;
    if (!name || !brand || !value || !currency || !image) {
      return res.status(400).json({ error: "All fields are required, including image" });
    }

    const giftCard = new GiftCard({ name, brand, value, currency, image });
    await giftCard.save();
    res.status(201).json(giftCard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟡 Update a gift card (Admin Only)
router.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    const giftCard = await GiftCard.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!giftCard) return res.status(404).json({ error: "Gift card not found" });
    res.json(giftCard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔴 Delete a gift card (Admin Only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    await GiftCard.findByIdAndDelete(req.params.id);
    res.json({ message: "Gift card deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ... other imports and code ...

// 🟠 Redeem a gift card (User)
router.post("/:id/redeem", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    const giftCard = await GiftCard.findById(req.params.id);
    if (!giftCard) return res.status(404).json({ error: "Gift card not found" });

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const { amount } = req.body;
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount greater than zero is required" });
    }

    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ timeout: 30000 }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await uploadToCloudinary();

    const redemption = new Redemption({
      userId: req.user._id,
      giftCardId: giftCard._id,
      cardType: giftCard.name, // Add cardType required by schema
      image: result.secure_url,
      amount: parseFloat(amount),
      status: "pending",
    });

    await redemption.save();

    res.status(201).json({ message: "Redemption submitted", redemption });
  } catch (err) {
    console.error("Redemption error:", err);
    res.status(500).json({ error: "Server error, please try again later" });
  }
});

export default router;
