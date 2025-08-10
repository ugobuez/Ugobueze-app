import express from 'express';
import { authenticateToken, authenticateAdmin } from '../middleware/auth.js';
import Activity from '../src/model/activity.js'; // Use default import

import nodemailer from 'nodemailer'; // For sending emails
const router = express.Router();

// GET /api/activities - Fetch all activities (admin-only) and send email notification
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // Fetch all activities, sorted by most recent
    const activities = await Activity.find({}).sort({ createdAt: -1 });
    console.log(`Fetched ${activities.length} activities (admin view)`);

    // Prepare email content
    let emailBody = 'Recent User Activities:\n\n';
    activities.forEach(activity => {
      emailBody += `User ID: ${activity.userId || 'N/A'}, Type: ${activity.type || 'N/A'}, Details: ${activity.details || 'N/A'}, Date: ${activity.createdAt || 'N/A'}\n`;
    });

    // Set up Nodemailer transporter using Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // e.g., ugochukwumeshach5@gmail.com
        pass: process.env.GMAIL_APP_PASSWORD, // App Password from Gmail
      },
    });

    // Email options
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL, // e.g., ugochukwumeshach8@gmail.com
      subject: 'Gift Card App: All User Activities Report',
      text: emailBody,
    };

    // Send the email (allow response even if email fails)
    try {
      await transporter.sendMail(mailOptions);
      console.log('Activity report emailed to admin');
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr.message);
      // Optionally include email error in response for debugging
      return res.status(200).json({
        success: true,
        data: activities,
        emailWarning: 'Activities fetched, but email notification failed',
      });
    }

    // Return activities as JSON
    res.status(200).json({ success: true, data: activities });
  } catch (err) {
    console.error('Error fetching activities:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

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