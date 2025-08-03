import express from "express";
import _ from "lodash";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, validateUser } from "../model/user.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Register new user
router.post("/", async (req, res) => {
  const { error } = validateUser(req.body);
  if (error) {
    console.error("Validation error:", error.details[0].message);
    return res.status(400).send(error.details[0].message);
  }

  let user = await User.findOne({ email: req.body.email });
  if (user) {
    console.error("User already registered:", req.body.email);
    return res.status(400).send("User already registered.");
  }

  user = new User(_.pick(req.body, ["name", "email", "password"]));
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);

  try {
    await user.save();
  } catch (err) {
    console.error("Error creating user:", err.message);
    return res.status(500).send("Error creating user: " + err.message);
  }

  const jwtPrivateKey = process.env.JWT_SECRET;
  if (!jwtPrivateKey) {
    console.error("JWT_SECRET missing during registration");
    return res.status(500).json({ message: "JWT secret is missing from environment variables." });
  }

  console.log("Register: Using JWT_SECRET:", jwtPrivateKey.substring(0, 5) + "...");
  const payload = {
    _id: user._id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
  };

  const token = jwt.sign(payload, jwtPrivateKey, { expiresIn: "1h" });
  console.log("Register: Token generated:", { token: token.substring(0, 20) + "...", userId: user._id });

  res.send({ ..._.pick(user, ["_id", "name", "email"]), token });
});

// Login user
router.post("/loginNow", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    console.error("Login failed: Missing email or password", { email });
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error("Login failed: User not found", { email });
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.error("Login failed: Invalid password", { email });
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const jwtPrivateKey = process.env.JWT_SECRET;
    if (!jwtPrivateKey) {
      console.error("JWT_SECRET missing during login");
      return res.status(500).json({ error: "JWT secret is missing" });
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
    console.error("Login error:", { error: err.message, email });
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user data
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name email balance");
    if (!user) {
      console.error("User not found for /me:", { userId: req.user._id });
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user data:", { error: err.message, userId: req.user._id });
    res.status(500).json({ error: "Server error" });
  }
});

export default router;