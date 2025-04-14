const express = require("express");
const Redemption = require("../model/redeem");
const authMiddleware = require("../middlewave/auth");

const router = express.Router();

// Upload and request redemption
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

// Admin: Approve redemption
router.put("/:id/approve", authMiddleware("admin"), async (req, res) => {
  try {
    await Redemption.findByIdAndUpdate(req.params.id, { status: "approved" });
    res.json({ message: "Redemption approved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reject redemption
router.put("/:id/reject", authMiddleware("admin"), async (req, res) => {
  try {
    await Redemption.findByIdAndUpdate(req.params.id, { status: "rejected" });
    res.json({ message: "Redemption rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;