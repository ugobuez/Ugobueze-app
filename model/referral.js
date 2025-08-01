// models/referral.js
import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrerCode: { type: String, required: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  isRedeemed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Referral', referralSchema);
