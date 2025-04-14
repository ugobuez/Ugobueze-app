import express from "express";
import GiftCard from "../model/giftcard.js";
import { authenticateToken, authenticateAdmin } from "../middlewave/auth.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import streamifier from "streamifier";

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

// 🟠 Upload proof of redemption (User)
router.post("/:id/redeem", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    const giftCard = await GiftCard.findById(req.params.id);
    if (!giftCard) return res.status(404).json({ error: "Gift card not found" });

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    console.log("Incoming request body:", req.body);
    console.log("Uploaded file:", req.file);

    const { amount } = req.body;
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount greater than zero is required" });
    }

    console.log("Current redemptions:", giftCard.redemptions);

    giftCard.redemptions = giftCard.redemptions.filter((redemption) => {
      const isValid = redemption.amount != null && !isNaN(redemption.amount);
      if (!isValid) {
        console.warn("Removing invalid redemption:", redemption);
      }
      return isValid;
    });

    const uploadFromBuffer = () => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 3;
        const timeoutMs = 30000;

        const attemptUpload = () => {
          attempts += 1;
          const stream = cloudinary.uploader.upload_stream(
            { timeout: timeoutMs },
            (error, result) => {
              if (error) {
                if (error.name === "TimeoutError" && attempts < maxAttempts) {
                  console.warn(`Upload attempt ${attempts} failed, retrying...`);
                  return attemptUpload();
                }
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        };

        attemptUpload();
      });
    };

    const result = await uploadFromBuffer();

    const redemption = {
      userId: req.user._id,
      image: result.secure_url,
      amount: parseFloat(amount),
      status: "pending",
    };

    console.log("Redemption to save:", redemption);

    giftCard.redemptions.push(redemption);
    console.log("Redemptions after push:", giftCard.redemptions);

    await giftCard.save();

    res.status(201).json({ message: "Redemption request submitted", redemption });
  } catch (err) {
    console.error("Error submitting redemption request:", {
      message: err.message,
      name: err.name,
      http_code: err.http_code,
      stack: err.stack,
    });
    if (err.name === "ValidationError") {
      res.status(400).json({ error: `Validation failed: ${err.message}` });
    } else if (err.name === "TimeoutError") {
      res.status(504).json({ error: "Image upload timed out, please try again" });
    } else {
      res.status(500).json({ error: "Server error, please try again later" });
    }
  }
});

export default router;