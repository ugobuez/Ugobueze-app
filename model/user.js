import mongoose from 'mongoose';
import Joi from 'joi';

// Withdrawal Subdocument Schema
const withdrawalSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  accountNumber: { type: String }, // Optional
  bankName: { type: String }, // Optional
  accountName: { type: String }, // Optional
}, { _id: true });

// Main User Schema
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
    sparse: true,
  },
  referrals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  referredBy: {
    type: String,
    default: null,
  },
  referralEarnings: {
    type: Number,
    default: 0,
  },
  withdrawals: [withdrawalSchema],
}, { timestamps: true });

// User Model
export const User = mongoose.model('User', userSchema);

// Joi Validator
export const validateUser = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    referredBy: Joi.string().optional().allow(null, ''),
    isAdmin: Joi.boolean().optional(),
  });

  return schema.validate(data);
};