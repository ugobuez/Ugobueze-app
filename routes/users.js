import express from "express";
import _ from "lodash";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import shortid from "shortid";
import { User, validateUser } from "../model/user.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// ✅ Generate unique referral code
const generateUniqueReferralCode = async () => {
  let referralCode;
  let isUnique = false;
  while (!isUnique) {
    referralCode = shortid.generate();
    const existingUser = await User.findOne({ referralCode });
    if (!existingUser) isUnique = true;
  }
  return referralCode;
};

// ✅ Register new user with role + referral code generation
router.post('/', async (req, res) => {
  try {
    const { error } = validateUser(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // ✅ Generate referral code
    const referralCode = await generateUniqueReferralCode();

    // ✅ Assign user fields
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      referredBy: req.body.referredBy,
      isAdmin: req.body.isAdmin || false,
      role: req.body.isAdmin ? 'admin' : 'user',
      referralCode, // ✅ set generated referral code
    });

    await user.save();

    // ✅ Generate token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      referralCode: user.referralCode,
      token,
    });
  } catch (err) {
    console.error('User registration error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Direct password reset (no token)
router.post('/reset-password', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).send('Email and new password are required.');

  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User with this email does not exist.');

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);

  try {
      await user.save();
      res.send('Password has been reset successfully.');
  } catch (err) {
      res.status(500).send('Error updating password: ' + err.message);
  }
});

// ✅ Login route
router.post("/loginnow", async (req, res) => {
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
      role: user.role || "user",
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

// ✅ Get current user data
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
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
