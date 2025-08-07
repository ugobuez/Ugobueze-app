const express = require('express');
const router = express.Router();
const {
  createTransaction,
  getAllTransactions,
  getUserTransactions,
  updateTransactionStatus
} = require('../controllers/transactionController');

// Create new transaction
router.post('/', createTransaction);

// Admin: Get all transactions
router.get('/', getAllTransactions);

// User: Get user-specific transactions
router.get('/:userId', getUserTransactions);

// Admin: Update status (approve/reject)
router.patch('/:id/status', updateTransactionStatus);

module.exports = router;
