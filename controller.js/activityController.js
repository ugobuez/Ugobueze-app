import Activity from '../model/activity.js';

export const createActivity = async (req, res) => {
  try {
    const activity = new Activity({ ...req.body, userId: req.user.id });
    await activity.save();
    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating activity:', error.message);
    res.status(500).json({ error: 'Failed to create activity' });
  }
};

export const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error.message);
    res.status(500).json({ error: 'Failed to get activities' });
  }
};

export const getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findOne({ _id: req.params.id, userId: req.user.id });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json(activity);
  } catch (error) {
    console.error('Error fetching activity:', error.message);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
};

export const updateActivity = async (req, res) => {
  try {
    const updated = await Activity.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Activity not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating activity:', error.message);
    res.status(500).json({ error: 'Failed to update activity' });
  }
};

export const deleteActivity = async (req, res) => {
  try {
    const deleted = await Activity.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Activity not found' });
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error.message);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
};