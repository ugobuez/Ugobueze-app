import express from "express";
import _ from "lodash";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, validateUser } from "../model/user.js";
import { authenticateToken } from "../middlewave/auth.js";

const router = express.Router();

// ✅ Health check: GET /api/user
router.get("/", (req, res) => {
  res.send("User signup endpoint is live. Use POST to register.");
});

// ✅ Register new user with referral update
router.post("/", async (req, res) => {
  const { error } = validateUser(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const { name, email, password, phone, referredBy } = req.body;

  let existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).send("User already registered.");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Generate a referral code for the new user
  const referralCode = Math.random().toString(36).substring(2, 8);

  const user = new User({
    name,
    email,
    password: hashedPassword,
    phone,
    referralCode,
    referredBy,
  });

  try {
    // ✅ If user was referred, reward the referrer
    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.referrals.push(user._id);
        referrer.referralEarnings += 3;
        referrer.balance += 3;
        await referrer.save();
      }
    }

    await user.save();
  } catch (err) {
    return res.status(500).send("Error creating user: " + err.message);
  }

  const token = jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.send({
    _id: user._id,
    name: user.name,
    email: user.email,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    token,
  });
});

// ✅ Fetch all users referred by the logged-in user
router.get("/referrals", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.referralCode) {
      return res.status(404).json({ error: "User or referral code not found" });
    }

    const referredUsers = await User.find({ referredBy: user.referralCode }).select("_id name email signupDate");
    res.json(referredUsers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch referrals" });
  }
});

// ✅ Get leaderboard
router.get("/referrals/leaderboard", async (req, res) => {
  try {
    const leaderboard = await User.find({ referralEarnings: { $gt: 0 } })
      .sort({ referralEarnings: -1 })
      .limit(10)
      .select("name referralEarnings referrals");

    const formatted = leaderboard.map(user => ({
      name: user.name,
      referralCount: user.referrals.length,
      referralEarnings: user.referralEarnings,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// ✅ Get individual referral stats
router.get("/referrals/stats/:referralCode", async (req, res) => {
  try {
    const user = await User.findOne({ referralCode: req.params.referralCode }).select("name referrals referralEarnings");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      name: user.name,
      referralCount: user.referrals.length,
      referralEarnings: user.referralEarnings,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ✅ Get current logged-in user
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name email balance");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
