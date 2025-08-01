import mongoose from "mongoose";
import Joi from "joi";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// User schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, minlength: 2, maxlength: 50 },
  email: { type: String, required: true, unique: true, minlength: 5, maxlength: 255 },
  password: { type: String, required: true, minlength: 6, maxlength: 1024 },
  phone: { type: String, default: "" },
  isAdmin: { type: Boolean, default: false },
  referralCode: { type: String, unique: true, default: () => crypto.randomBytes(3).toString("hex") },
  referredBy: { type: String, default: "" },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  referralEarnings: { type: Number, default: 0 },
  signupDate: { type: Date, default: Date.now },
  balance: { type: Number, default: 0 }
});

// Method to generate auth token
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { _id: this._id, name: this.name, email: this.email, isAdmin: this.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

export const User = mongoose.model("User", userSchema);

// ✅ Joi validation function (now includes phone!)
export function validateUser(user) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().min(5).max(255).email().required(),
    password: Joi.string().min(6).max(255).required(),
    phone: Joi.string().allow("").optional(),
    referredBy: Joi.string().allow("").optional()
  });

  return schema.validate(user);
}
