import express from 'express';
import Joi from 'joi';
import { authenticateToken, authenticateAdmin } from '../middleware/auth.js';
import { User } from '../model/user.js';
import logActivity from '../utils/logActivity.js';

const router = express.Router();

// Joi validation schema for withdrawal submission
const validateWithdrawal = (data) => {
  const schema = Joi.object({
    amount: Joi.number().positive().min(1).required(),
    accountNumber: Joi.string().required(),
    bankName: Joi.string().required(),
    accountName: Joi.string().required(),
  });
  return schema.validate(data);
};

// Joi validation schema for withdrawal approval
const validateWithdrawalStatus = (data) => {
  const schema = Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
  });
  return schema.validate(data);
};

// ==================== USER ROUTE ====================
// POST /api/admin/withdrawals - Submit a withdrawal request
router.post('/', authenticateToken, async (req, res) => {
  const { error } = validateWithdrawal(req.body);
  if (error) {
    console.log(`Validation error in POST /api/admin/withdrawals: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log(`User not found for ID: ${req.user.id}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const { amount, accountNumber, bankName, accountName } = req.body;

    if (user.balance < amount) {
      console.log(`Insufficient balance for user ${req.user.id}: ${user.balance} < ${amount}`);
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct balance and push withdrawal request
    user.balance -= amount;
    const newWithdrawal = {
      amount,
      status: 'pending',
      date: new Date(),
      accountNumber,
      bankName,
      accountName,
    };

    user.withdrawals.push(newWithdrawal);
    await user.save();

    // Log activity
    await logActivity({
      userId: req.user.id,
      type: 'withdrawal',
      title: 'Withdrawal Requested',
      description: `You requested a withdrawal of $${amount}.`,
    });

    console.log(`Withdrawal request submitted for user ${req.user.id}: $${amount}`);
    res.status(200).json({
      message: 'Withdrawal request submitted successfully',
      remainingBalance: user.balance,
      withdrawal: newWithdrawal,
    });
  } catch (err) {
    console.error('Withdrawal error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ==================== ADMIN ROUTES ====================
// GET /api/admin/withdrawals/all - View all withdrawal requests
router.get('/all', authenticateAdmin, async (req, res) => {
  try {
    const usersWithWithdrawals = await User.find({ 'withdrawals.0': { $exists: true } })
      .select('name email withdrawals');

    console.log(`Fetched ${usersWithWithdrawals.length} users with withdrawals`);
    res.status(200).json(usersWithWithdrawals);
  } catch (err) {
    console.error('Error fetching withdrawals:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// PATCH /api/admin/withdrawals/:withdrawalId - Approve or reject a withdrawal
router.patch('/:withdrawalId', authenticateAdmin, async (req, res) => {
  const { withdrawalId } = req.params;
  const { error } = validateWithdrawalStatus(req.body);
  if (error) {
    console.log(`Validation error in PATCH /api/admin/withdrawals/${withdrawalId}: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }

  const { status } = req.body;

  console.log(`Processing PATCH /api/admin/withdrawals/${withdrawalId} with status: ${status}`);

  try {
    const user = await User.findOne({ 'withdrawals._id': withdrawalId });
    if (!user) {
      console.log(`User not found for withdrawal ID: ${withdrawalId}`);
      return res.status(404).json({ error: 'User or withdrawal not found' });
    }

    const withdrawal = user.withdrawals.id(withdrawalId);
    if (!withdrawal) {
      console.log(`Withdrawal not found: ${withdrawalId}`);
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    // Update withdrawal status
    withdrawal.status = status;

    // If rejected, refund the amount to the user's balance
    if (status === 'rejected') {
      user.balance += withdrawal.amount;
      await logActivity({
        userId: user._id,
        type: 'withdrawal',
        title: 'Withdrawal Rejected',
        description: `Your withdrawal of $${withdrawal.amount} was rejected and funds have been returned to your balance.`,
      });
    } else if (status === 'approved') {
      await logActivity({
        userId: user._id,
        type: 'withdrawal',
        title: 'Withdrawal Approved',
        description: `Your withdrawal of $${withdrawal.amount} was approved.`,
      });
    }

    await user.save();

    // Fetch updated user to ensure latest state
    const updatedUser = await User.findOne({ 'withdrawals._id': withdrawalId });
    const updatedWithdrawal = updatedUser.withdrawals.id(withdrawalId);

    console.log(`Withdrawal ${withdrawalId} updated to status: ${status}, user balance: ${updatedUser.balance}`);
    res.status(200).json({
      message: `Withdrawal ${status} successfully`,
      withdrawal: updatedWithdrawal,
      remainingBalance: updatedUser.balance,
    });
  } catch (err) {
    console.error('Admin withdrawal update error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;