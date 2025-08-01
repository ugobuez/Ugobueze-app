import express from "express";
import Redemption from "../model/redeem.js";
import User from "../model/user.js";
import Referral from "../model/referral.js";
import authMiddleware from "../middlewave/auth.js";

const router = express.Router();

// ✅ User submits redemption request
router.post("/", authMiddleware(), async (req, res) => {
  try {
    const { giftCardId, imageUrl } = req.body;
    const redemption = new Redemption({ userId: req.user.userId, giftCardId, imageUrl });
    await redemption.save();
    res.status(201).json({ message: "Redemption request submitted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ Admin approves redemption and rewards referrer
router.put("/:id/approve", authMiddleware("admin"), async (req, res) => {
  try {
    const redemption = await Redemption.findById(req.params.id);
    if (!redemption) return res.status(404).json({ error: "Redemption not found" });

    if (redemption.status === "approved") {
      return res.status(400).json({ message: "Redemption already approved" });
    }

    redemption.status = "approved";
    await redemption.save();

    const user = await User.findById(redemption.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ Get gift card amount (you must store amount on giftCard or redemption)
    const giftCard = await GiftCard.findById(redemption.giftCardId);
    const amount = giftCard?.amount || 0; // adjust logic if needed

    user.balance += amount;
    await user.save();

    // ✅ Apply referral bonus if not already redeemed
    if (user.referredBy) {
      const referral = await Referral.findOne({
        referrerCode: user.referredBy,
        referredUserId: user._id,
        isRedeemed: false,
      });

      if (referral) {
        referral.isRedeemed = true;
        await referral.save();

        const referrer = await User.findOne({ referralCode: user.referredBy });
        if (referrer) {
          referrer.referralEarnings += 3;
          await referrer.save();
          console.log(`✅ Credited $3 to ${referrer.name}`);
        }
      }
    }

    res.json({ message: "Redemption approved and referrer rewarded (if applicable)" });
  } catch (err) {
    console.error("❌ Error approving redemption:", err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Admin rejects redemption
router.put("/:id/reject", authMiddleware("admin"), async (req, res) => {
  try {
    await Redemption.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.json({ message: "Redemption rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
