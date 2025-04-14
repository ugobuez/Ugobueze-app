import mongoose from "mongoose";

const GiftCardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    value: { type: Number, required: true },
    currency: { type: String, required: true },
    image: { type: String, required: true },
    redemptions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        image: { type: String, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        reason: { type: String }, // Optional field for rejection reason
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("GiftCard", GiftCardSchema);