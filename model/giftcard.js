// In giftcard.js
import mongoose from "mongoose";

const GiftCardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    value: { type: Number, required: true },
    currency: { type: String, required: true },
    image: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("GiftCard", GiftCardSchema);