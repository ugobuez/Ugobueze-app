import express from "express";
import _ from "lodash";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import shortid from "shortid";
import { User, validateUser } from "../model/user.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Generate a unique referral code
const generateUniqueReferralCode = async () => {
  let referralCode;
  let isUnique = false;
  while (!isUnique) {
    referralCode = shortid.generate();
    const existingUser = await User.findOne({ referralCode });
    if (!existingUser) {
      isUnique = true;
    }
  }
  return referralCode;
};

// Register new user with referral code generation
router.post("/", async (req, res) => {
  const { error } = validateUser(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  let user = await User.findOne({ email: req.body.email });
  if (user) {
    return res.status(400).send("User already registered.");
  }

  user = new User(_.pick(req.body, ["name", "email", "password", "referredBy"]));
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);

  try {
    user.referralCode = await generateUniqueReferralCode();
  } catch (err) {
    console.error("Error generating referral code:", err);
    return res.status(500).send("Error generating referral code: " + err.message);
  }

  if (user.referredBy) {
    const referrer = await User.findOne({ referralCode: user.referredBy });
    if (referrer) {
      referrer.referrals = referrer.referrals || [];
      referrer.referrals.push(user._id);
      referrer.balance = (referrer.balance || 0) + 3;
      try {
        await referrer.save();
      } catch (err) {
        console.error("Error updating referrer:", err);
        return res.status(500).send("Error updating referrer: " + err.message);
      }
    } else {
      user.referredBy = undefined;
    }
  }

  try {
    await user.save();
  } catch (err) {
    console.error("Error saving user:", err);
    return res.status(500).send("Error creating user: " + err.message);
  }

  const jwtPrivateKey = process.env.JWT_SECRET;
  if (!jwtPrivateKey) {
    return res.status(500).json({ message: "JWT secret is missing from environment variables." });
  }

  const payload = {
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

  res.send({
    ..._.pick(user, ["_id", "name", "email", "referralCode"]),
    token,
  });
});

// Login user
router.post("/loginnow", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const payload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({
      token,
      user: _.pick(user, ["_id", "name", "email", "isAdmin", "referralCode", "balance"]),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user data
router.get("/me", authenticateToken, async (req, res) => {
  console.log('Received request to /api/users/me with token:', req.headers.authorization);
  try {
    const user = await User.findById(req.user._id).select("name email balance referralCode referrals");
    if (!user) {
      console.log('User not found for ID:', req.user._id);
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      balance: user.balance || 0,
      referralCode: user.referralCode || '',
      referredCount: user.referrals?.length || 0,
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;