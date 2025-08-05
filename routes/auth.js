import express from "express";
import _ from "lodash";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { User, validateUser } from "../model/user.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();





// Login with role-based JWT (user/admin)
router.post("/loginNow", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "Invalid email or password" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ error: "Invalid email or password" });

    const payload = {
      id: user._id,
      email: user.email,
      isAdmin: user.role === "admin", // Check if the user is an admin
      role: user.role || "user" || "admin", // Default to 'user' if role is not set
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: _.pick(user, ["_id", "name", "email", "role", "referralCode", "balance"]),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user data (protected route)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email balance referralCode referrals"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      balance: user.balance || 0,
      referralCode: user.referralCode || "",
      referredCount: user.referrals?.length || 0,
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
