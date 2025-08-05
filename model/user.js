import mongoose from 'mongoose';
import Joi from 'joi';

// ✅ Define Mongoose Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  balance: {
    type: Number,
    default: 0,
  },
  referralCode: {
    type: String,
    unique: true,
  },
  referrals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  referredBy: {
    type: String,
  },
  referralEarnings: {
    type: Number,
    default: 0,
  },
});

// ✅ Create Mongoose model
export const User = mongoose.model('User', userSchema);

// ✅ Joi validation for registration
export const validateUser = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    referredBy: Joi.string().optional(),
    isAdmin: Joi.boolean().optional(), // now correctly handled
  });

  return schema.validate(data);
};
