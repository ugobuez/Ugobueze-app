import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Activity from '../src/model/activity.js';
import { sendActivityEmail } from '../utils/logActivity.js';

const router = express.Router();

// GET /api/activities - Admin gets all, user gets only their own
router.get('/', authenticateToken, async (req, res) => {
  try {
    let activities;
    let emailTo;
    let subject;

    if (req.user.isAdmin) {
      // Admin: fetch all
      activities = await Activity.find({}).sort({ createdAt: -1 });
      console.log(`Fetched ${activities.length} activities (admin view)`);

      // Send admin report if there are important activities
      const importantActivities = activities.filter(
        (activity) =>
          activity.type === 'gift_card_submission' || activity.type === 'withdrawal'
      );
      if (importantActivities.length > 0) {
        emailTo = process.env.ADMIN_EMAIL;
        subject = 'Gift Card App: Important Activities Report';
        try {
          await sendActivityEmail(importantActivities, emailTo, subject, true);
        } catch (emailErr) {
          return res.status(200).json({
            success: true,
            data: activities,
            emailWarning:
              'Activities fetched, but email notification to admin failed',
          });
        }
      }
    } else {
      // Regular user: fetch only their activities
      activities = await Activity.find({ userId: req.user.id }).sort({ createdAt: -1 });
      console.log(`Fetched ${activities.length} activities for user ${req.user.id}`);

      if (activities.length > 0) {
        emailTo = req.user.email;
        subject = 'Gift Card App: Your Activity Report';
        try {
          await sendActivityEmail(activities, emailTo, subject, false);
        } catch (emailErr) {
          return res.status(200).json({
            success: true,
            data: activities,
            emailWarning:
              'Activities fetched, but email notification to user failed',
          });
        }
      }
    }

    res.status(200).json({ success: true, data: activities });
  } catch (err) {
    console.error('Error fetching activities or sending email:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

export default router;
