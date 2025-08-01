import express from "express";
import _ from "lodash";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, validateUser } from "../model/user.js";
import Referral from "../model/referral.js";
import { authenticateToken } from "../middlewave/auth.js";

const router = express.Router();

// ✅ Register new user with optional referral
router.post("/", async (req, res) => {
  const { error } = validateUser(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const { name, email, password, referredBy } = req.body;

  let existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).send("User already registered.");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = new User({
    name,
    email,
    password: hashedPassword,
    referredBy,
  });

  try {
    await user.save();

    // ✅ Create referral record if referredBy is valid
    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        // Add to referrer's referrals array
        referrer.referrals.push(user._id);
        await referrer.save();

        // Create referral entry to track redemption status
        const referral = new Referral({
          referrerCode: referredBy,
          referredUserId: user._id.toString(),
        });
        await referral.save();
      }
    }
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

export default router;
