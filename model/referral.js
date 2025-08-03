// model/referral.js
import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrerCode: { type: String, required: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isRedeemed: { type: Boolean, default: false },
  totalApprovedAmount: { type: Number, default: 0 },
});

export const Referral = mongoose.model('Referral', referralSchema);