import nodemailer from 'nodemailer';
import { User } from '../model/user.js';
import Activity from '../src/model/activity.js';

// Send activity email to user and optionally to admin (for important activities)
const sendActivityEmail = async ({ userId, type, title, description, createdAt }) => {
  try {
    // Fetch user email from User model
    const user = await User.findById(userId).select('email');
    if (!user || !user.email) {
      console.error('User not found or no email for userId:', userId);
      return; // Skip if user or email not found
    }

    // Initialize email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Prepare user email
    const userEmailBody = `Your Recent Activity:\n\nType: ${type || 'N/A'}\nTitle: ${title || 'N/A'}\nDescription: ${description || 'N/A'}\nDate: ${createdAt || 'N/A'}`;
    const userMailOptions = {
      from: process.env.GMAIL_USER,
      to: user.email,
      subject: 'Gift Card App: Your Activity Notification',
      text: userEmailBody,
    };

    // Send email to user
    await transporter.sendMail(userMailOptions);
    console.log(`Activity email sent to user: ${user.email}`);

    // Check if activity is important (for admin notification)
    const isImportant = type === 'gift_card_submission' || type === 'withdrawal';
    if (isImportant) {
      const adminEmailBody = `Important Activity Notification:\n\nUser ID: ${userId || 'N/A'}\nType: ${type || 'N/A'}\nTitle: ${title || 'N/A'}\nDescription: ${description || 'N/A'}\nDate: ${createdAt || 'N/A'}`;
      const adminMailOptions = {
        from: process.env.GMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'Gift Card App: Important Activity Notification',
        text: adminEmailBody,
      };

      // Send email to admin
      await transporter.sendMail(adminMailOptions);
      console.log(`Important activity email sent to admin: ${process.env.ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.error('Error sending activity email:', err.message);
    throw err;
  }
};

// Modified to call sendActivityEmail after logging
const logActivity = async ({ userId, type, title, description }) => {
  try {
    const activity = new Activity({
      userId,
      type,
      title,
      description,
      createdAt: new Date(),
    });
    await activity.save();
    console.log(`Activity logged for user ${userId}: ${title}`);

    // Send email notifications
    await sendActivityEmail({
      userId,
      type,
      title,
      description,
      createdAt: activity.createdAt,
    });
  } catch (err) {
    console.error('Error logging activity or sending email:', err.message);
    throw err;
  }
};

export default logActivity;
export { sendActivityEmail };
