// models/Referral.js
import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrerCode: { type: String, required: true },
  referredUserId: { type: String, required: true },
  isRedeemed: { type: Boolean, default: false },
}, { timestamps: true });

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
