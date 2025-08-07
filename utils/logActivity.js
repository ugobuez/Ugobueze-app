 // Correct case and default import
import Activity from '../src/model/activity.js'; // Ensure correct path and import
const logActivity = async ({ userId, type, title, description }) => {
  try {
    const activity = new Activity({
      userId,
      type,
      title,
      description,
    });
    await activity.save();
    console.log(`Activity logged for user ${userId}: ${title}`);
  } catch (err) {
    console.error('Error logging activity:', err.message);
    throw err; // Let the caller handle the error
  }
};

export default logActivity;