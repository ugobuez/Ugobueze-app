import mongoose from 'mongoose';

const redeemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  giftCardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GiftCard',
    required: true
  },
  cardType: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected']
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Redemption = mongoose.model('Redemption', redeemSchema);

export { Redemption };
