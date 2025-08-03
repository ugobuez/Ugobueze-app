import express from "express";
import _ from "lodash";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { check, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import { User, validateUser } from "../model/user.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Rate limiter for login and register (100 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests", message: "Try again later" },
});

// Register new user
router.post(
  "/",
  authLimiter,
  [
    check("name").trim().notEmpty().withMessage("Name is required"),
    check("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    check("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Register: Validation errors:", { errors: errors.array(), email: req.body.email });
      return res.status(400).json({ error: "Validation error", message: errors.array()[0].msg });
    }

    const { error } = validateUser(req.body);
    if (error) {
      console.error("Register: Joi validation error:", { message: error.details[0].message, email: req.body.email });
      return res.status(400).json({ error: "Validation error", message: error.details[0].message });
    }

    let user = await User.findOne({ email: req.body.email });
    if (user) {
      console.error("Register: User already exists:", { email: req.body.email });
      return res.status(400).json({ error: "User already registered", message: "Email already in use" });
    }

    user = new User(_.pick(req.body, ["name", "email", "password"]));
    const salt = await bcrypt.genSalt(12); // Increased salt rounds for production
    user.password = await bcrypt.hash(user.password, salt);

    try {
      await user.save();
      console.log("Register: User created:", { userId: user._id, email: user.email });
    } catch (err) {
      console.error("Register: Error creating user:", { error: err.message, email: req.body.email });
      return res.status(500).json({ error: "Server error", message: "Failed to create user" });
    }

    const jwtPrivateKey = process.env.JWT_SECRET;
    if (!jwtPrivateKey) {
      console.error("Register: JWT_SECRET missing");
      return res.status(500).json({ error: "Server error", message: "JWT secret is missing" });
    }

    console.log("Register: Using JWT_SECRET:", jwtPrivateKey.substring(0, 5) + "...");
    const payload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    try {
      const token = jwt.sign(payload, jwtPrivateKey, { expiresIn: "1h" });
      console.log("Register: Token generated:", { token: token.substring(0, 20) + "...", userId: user._id });
      res.json({ ..._.pick(user, ["_id", "name", "email", "isAdmin"]), token });
    } catch (err) {
      console.error("Register: Token generation error:", { error: err.message, email: user.email });
      return res.status(500).json({ error: "Server error", message: "Failed to generate token" });
    }
  }
);

// Login user
router.post(
  "/loginNow",
  authLimiter,
  [
    check("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    check("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Login: Validation errors:", { errors: errors.array(), email: req.body.email });
      return res.status(400).json({ error: "Validation error", message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        console.error("Login: User not found:", { email });
        return res.status(400).json({ error: "Invalid credentials", message: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.error("Login: Invalid password:", { email });
        return res.status(400).json({ error: "Invalid credentials", message: "Invalid email or password" });
      }

      const jwtPrivateKey = process.env.JWT_SECRET;
      if (!jwtPrivateKey) {
        console.error("Login: JWT_SECRET missing");
        return res.status(500).json({ error: "Server error", message: "JWT secret is missing" });
      }

      console.log("Login: Using JWT_SECRET:", jwtPrivateKey.substring(0, 5) + "...");
      const payload = {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      };

      const token = jwt.sign(payload, jwtPrivateKey, { expiresIn: "1h" });
      console.log("Login: Token generated:", { token: token.substring(0, 20) + "...", userId: user._id });
      res.json({ token, user: _.pick(user, ["_id", "name", "email", "isAdmin"]) });
    } catch (err) {
      console.error("Login: Server error:", { error: err.message, email });
      return res.status(500).json({ error: "Server error", message: "Failed to login" });
    }
  }
);

// Get current user data
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name email balance");
    if (!user) {
      console.error("Get /me: User not found:", { userId: req.user._id });
      return res.status(404).json({ error: "Not found", message: "User not found" });
    }
    console.log("Get /me: User fetched:", { userId: user._id, email: user.email });
    res.json(user);
  } catch (err) {
    console.error("Get /me: Error fetching user:", { error: err.message, userId: req.user._id });
    res.status(500).json({ error: "Server error", message: "Failed to fetch user" });
  }
});

export default router;