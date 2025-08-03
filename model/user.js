// model/user.js
import mongoose from 'mongoose';
import Joi from 'joi';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  referredBy: { type: String },
  referralEarnings: { type: Number, default: 0 }, // Added for referral stats
});

export const User = mongoose.model('User', userSchema);

export const validateUser = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    referredBy: Joi.string().optional(),
  });
  return schema.validate(data);
};