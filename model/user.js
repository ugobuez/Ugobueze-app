import mongoose from "mongoose";
import Joi from "joi";
import jwt from "jsonwebtoken";
import shortid from "shortid";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, minlength: 3, maxlength: 50 },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 6 },
  isAdmin: { type: Boolean, default: false },

  referralCode: {
    type: String,
    default: () => shortid.generate(),
    unique: true,
  },
  referredBy: { type: String }, // stores referralCode of the referrer
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  referralEarnings: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  signupDate: { type: Date, default: Date.now },
});

// JWT Token Method
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      name: this.name,
      email: this.email,
      isAdmin: this.isAdmin,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

const User = mongoose.model("User", userSchema);

// Joi Validation Function
function validateUser(user) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().required().email(),
    password: Joi.string().min(6).required(),
    referredBy: Joi.string().optional(), // referral code if provided
  });

  return schema.validate(user);
}


export { User, validateUser };
