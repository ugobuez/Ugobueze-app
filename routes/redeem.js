import express from "express";
import Redemption from "../model/redeem.js";
import GiftCard from "../model/giftcard.js";
import User from "../model/user.js";
import Referral from "../model/referral.js";
import authMiddleware from "../middlewave/auth.js";

const router = express.Router();
const REFERRAL_BONUS = Number(process.env.REFERRAL_BONUS || 3);

// Submit a redemption request
router.post("/", authMiddleware(), async (req, res) => {
  try {
    const { giftCardId, imageUrl } = req.body;

    const giftCard = await GiftCard.findById(giftCardId);
    if (!giftCard) return res.status(404).json({ error: "Gift card not found" });

    const redemption = new Redemption({
      userId: req.user.userId,
      giftCardId,
      imageUrl,
      amount: giftCard.amount || 0,
    });

    await redemption.save();
    res.status(201).json({ message: "Redemption request submitted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin approves redemption and gives referral bonus
router.put("/:id/approve", authMiddleware("admin"), async (req, res) => {
  try {
    const redemption = await Redemption.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: "Redemption not found" });

    if (redemption.status === "approved") {
      return res.status(400).json({ message: "Redemption already approved" });
    }

    const giftCard = await GiftCard.findById(redemption.giftCardId);
    const amount = giftCard?.amount || redemption.amount || 0;

    const user = await User.findById(redemption.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    redemption.status = "approved";
    await redemption.save();

    user.balance += amount;
    await user.save();

    // Apply referral bonus if not yet redeemed
    if (user.referredBy) {
      const referral = await Referral.findOne({
        referrerCode: user.referredBy,
        referredUserId: user._id.toString(),
        isRedeemed: false,
      });

      if (referral) {
        referral.isRedeemed = true;
        await referral.save();

        const referrer = await User.findOne({ referralCode: user.referredBy });
        if (referrer) {
          referrer.referralEarnings += REFERRAL_BONUS;
          await referrer.save();
        }
      }
    }

    res.json({ message: "Redemption approved and balance updated" });
  } catch (err) {
    console.error("Error approving redemption:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin rejects redemption
router.put("/:id/reject", authMiddleware("admin"), async (req, res) => {
  try {
    await Redemption.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.json({ message: "Redemption rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
