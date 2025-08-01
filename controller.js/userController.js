import { User } from "../model/user.js";

// Get user details
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// routes/user.routes.js (or add to user controller)
router.get('/users/:id/referrals', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const count = await Referral.countDocuments({
      referrerCode: user.referralCode,
      isRedeemed: true,
    });
    const earnings = count * 3;
    res.json({ count, earnings });
  } catch (error) {
    res.status(500).json({ error: 'Could not retrieve stats' });
  }
});


export { getUserDetails };
