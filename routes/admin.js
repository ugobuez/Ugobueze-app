import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../model/user.js";
import GiftCard from "../model/giftcard.js";
import { authenticateAdmin } from "../middlewave/auth.js";
import mongoose from "mongoose";

const router = express.Router();

// Admin Login Route
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

    const jwtPrivateKey = process.env.JWT_SECRET;
    if (!jwtPrivateKey) {
      return res.status(500).json({ message: "JWT secret is missing from environment variables." });
    }

    const token = jwt.sign(
      { _id: user._id, isAdmin: user.isAdmin },
      jwtPrivateKey,
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin Protected Route Example
router.get("/dashboard", authenticateAdmin, async (req, res) => {
  try {
    const admins = await User.find({ isAdmin: true }).select("-password");
    res.json(admins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Fetch all redemptions for admin
router.get("/redemptions", authenticateAdmin, async (req, res) => {
  try {
    const redemptions = await GiftCard.aggregate([
      { $unwind: "$redemptions" },
      {
        $lookup: {
          from: "users",
          localField: "redemptions.userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $project: {
          _id: "$redemptions._id",
          giftCardId: "$_id",
          giftCardName: "$name",
          userId: "$redemptions.userId",
          userName: { $arrayElemAt: ["$userDetails.name", 0] },
          userEmail: { $arrayElemAt: ["$userDetails.email", 0] },
          amount: "$redemptions.amount",
          image: "$redemptions.image",
          status: "$redemptions.status",
          reason: "$redemptions.reason",
        },
      },
    ]);

    if (!redemptions.length) {
      return res.status(404).json({ message: "No redemptions found" });
    }

    res.json(redemptions);
  } catch (err) {
    console.error("Error fetching redemptions:", err);
    res.status(500).json({ error: err.message });
  }
});

// Accept a redemption
router.post("/redemptions/:redemptionId/accept", authenticateAdmin, async (req, res) => {
    try {
      const { redemptionId } = req.params;
  
      if (!mongoose.Types.ObjectId.isValid(redemptionId)) {
        return res.status(400).json({ error: "Invalid redemption ID" });
      }
  
      const giftCard = await GiftCard.findOne({ "redemptions._id": redemptionId });
      if (!giftCard) {
        return res.status(404).json({ error: "Redemption not found" });
      }
  
      const redemption = giftCard.redemptions.id(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found" });
      }
  
      if (redemption.status === "approved") {
        return res.status(400).json({ error: "Redemption already approved" });
      }
  
      redemption.status = "approved";
      redemption.reason = undefined;
  
      const user = await User.findById(redemption.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const amount = redemption.amount;
      user.balance = (user.balance || 0) + amount;
      await user.save();
  
      console.log(`Updated balance for user ${user._id}: +${amount} = ${user.balance}`);
  
      await giftCard.save();
  
      res.json({ message: "Redemption approved", newBalance: user.balance });
    } catch (err) {
      console.error("Error accepting redemption:", err);
      res.status(500).json({ error: err.message });
    }
  });
// Reject a redemption
router.post("/redemptions/:redemptionId/reject", authenticateAdmin, async (req, res) => {
  try {
    const { redemptionId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(redemptionId)) {
      return res.status(400).json({ error: "Invalid redemption ID" });
    }

    const giftCard = await GiftCard.findOne({ "redemptions._id": redemptionId });
    if (!giftCard) {
      return res.status(404).json({ error: "Redemption not found" });
    }

    const redemption = giftCard.redemptions.id(redemptionId);
    if (!redemption) {
      return res.status(404).json({ error: "Redemption not found" });
    }

    if (redemption.status === "rejected") {
      return res.status(400).json({ error: "Redemption already rejected" });
    }

    redemption.status = "rejected";
    redemption.reason = reason || "No reason provided";

    await giftCard.save();

    res.json({ message: "Redemption rejected", reason: redemption.reason });
  } catch (err) {
    console.error("Error rejecting redemption:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;