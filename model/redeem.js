// model/redeem.js
import mongoose from 'mongoose';

const redeemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  giftCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'GiftCard', required: true },
  amount: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reason: String,
  createdAt: { type: Date, default: Date.now },
});

export const Redeem = mongoose.model('Redeem', redeemSchema);