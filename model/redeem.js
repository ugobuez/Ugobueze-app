import mongoose from 'mongoose';

const redeemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cardType: String,
  amount: Number,
  image: String,
  status: { type: String, default: 'pending' },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Redemption = mongoose.model('Redemption', redeemSchema);
export { Redemption };