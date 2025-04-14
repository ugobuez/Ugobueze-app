const mongoose = require("mongoose");

const RedemptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  giftCardId: { type: mongoose.Schema.Types.ObjectId, ref: "GiftCard", required: true },
  imageUrl: { type: String, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
}, { timestamps: true });

module.exports = mongoose.model("Redemption", RedemptionSchema);
