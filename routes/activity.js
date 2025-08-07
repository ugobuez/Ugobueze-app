import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Activity from '../src/model/activity.js'; // Use default import

const router = express.Router();

// GET /api/activities - Fetch all activities for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const activities = await Activity.find({ userId: req.user.id }).sort({ createdAt: -1 });
    console.log(`Fetched ${activities.length} activities for user ${req.user.id}`);
    res.status(200).json({ success: true, data: activities });
  } catch (err) {
    console.error('Error fetching activities:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

export default router;