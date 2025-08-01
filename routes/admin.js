import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../model/user.js";
import {Redemption }from "../model/redeem.js";
import GiftCard from "../model/giftcard.js";
import Referral from "../model/referral.js";
import { authenticateAdmin } from "../middlewave/auth.js";
import mongoose from "mongoose";

const router = express.Router();
const REFERRAL_BONUS = Number(process.env.REFERRAL_BONUS || 3);

// Admin login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { _id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all redemptions
router.get("/redemptions", authenticateAdmin, async (req, res) => {
  try {
    const redemptions = await Redemption.find()
      .populate("userId", "name email")
      .populate("giftCardId", "name amount")
      .sort({ createdAt: -1 });

    if (!redemptions.length) {
      return res.status(404).json({ message: "No redemptions found" });
    }

    res.json(redemptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve redemption
router.post("/redemptions/:id/approve", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

    const redemption = await Redemption.findById(id);
    if (!redemption) return res.status(404).json({ error: "Redemption not found" });

    if (redemption.status === "approved") return res.status(400).json({ error: "Already approved" });

    const user = await User.findById(redemption.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const giftCard = await GiftCard.findById(redemption.giftCardId);
    const amount = giftCard?.amount || redemption.amount || 0;

    redemption.status = "approved";
    await redemption.save();

    user.balance += amount;
    await user.save();

    // Apply referral bonus
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

    res.json({ message: "Redemption approved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject redemption
router.post("/redemptions/:id/reject", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

    const redemption = await Redemption.findById(id);
    if (!redemption) return res.status(404).json({ error: "Redemption not found" });

    if (redemption.status === "rejected") return res.status(400).json({ error: "Already rejected" });

    redemption.status = "rejected";
    redemption.reason = reason || "No reason provided";
    await redemption.save();

    res.json({ message: "Redemption rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;