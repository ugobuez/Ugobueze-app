import Joi from 'joi';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid'; // Generates unique referral codes

// Define User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, minlength: 3, maxlength: 50 },
  email: { type: String, required: true, minlength: 5, maxlength: 255, unique: true },
  password: { type: String, required: true, minlength: 5, maxlength: 1024 },
  balance: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  signupDate: { type: Date, default: Date.now },
  referralCode: { type: String, unique: true, default: () => nanoid(8) }, // e.g., "ABCD1234"
  referredBy: { type: String, default: null }, // The referralCode of the user who referred this user
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Users referred by this user
});

// Create User model
const User = mongoose.model('User', userSchema);

// Joi validation
function validateUser(user) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().min(5).max(255).required().email(),
    password: Joi.string().min(5).max(1024).required(),
    referredBy: Joi.string().optional(), // referralCode of the referrer
  });
  return schema.validate(user);
}

export { User, validateUser };
