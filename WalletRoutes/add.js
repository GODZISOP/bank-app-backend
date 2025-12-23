// backend/routes/wallet.js
import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

console.log('✅ Wallet routes loaded');

// Auth middleware
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer TOKEN"
    
    if (!token) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id || decoded._id; // Support both id and _id
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Get user balance (with auth)
router.get('/balance', authMiddleware, async (req, res) => {
  console.log('📊 GET /api/wallet/balance called');
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      balance: user.balance || 0,
      accountNumber: user.accountNumber 
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add funds (NO AUTH - for testing/admin)
router.post('/add-funds', async (req, res) => {
  console.log('💰 POST /api/wallet/add-funds called');
  console.log('Body:', req.body);
  try {
    const { userId, amount } = req.body;
    const amountNum = Number(amount);

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!amountNum || amountNum <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.balance = (user.balance || 0) + amountNum;
    await user.save();

    console.log(`✅ Added ৳${amountNum} to user ${userId}. New balance: ৳${user.balance}`);

    res.json({ 
      success: true,
      balance: user.balance,
      message: `Successfully added ৳${amountNum}` 
    });
  } catch (error) {
    console.error('Add funds error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Transfer funds (NO AUTH - uses fromUserId in body)
router.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toAccountNumber, amount } = req.body;
    const amountNum = Number(amount);

    // Validation
    if (!fromUserId || !toAccountNumber || !amountNum) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (amountNum <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    // Find sender
    const sender = await User.findById(fromUserId);
    if (!sender) {
      return res.status(404).json({ message: 'Sender not found' });
    }

    // Check balance
    if ((sender.balance || 0) < amountNum) {
      return res.status(400).json({ 
        message: 'Insufficient balance',
        currentBalance: sender.balance || 0
      });
    }

    // Find recipient by account number
    const recipient = await User.findOne({ accountNumber: toAccountNumber });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient account not found' });
    }

    // Check if sending to self
    if (sender._id.equals(recipient._id)) {
      return res.status(400).json({ message: 'Cannot transfer to your own account' });
    }

    // Perform transfer
    sender.balance = (sender.balance || 0) - amountNum;
    recipient.balance = (recipient.balance || 0) + amountNum;

    await sender.save();
    await recipient.save();

    console.log(`✅ Transfer: ${sender.accountNumber} → ${recipient.accountNumber}: ৳${amountNum}`);

    res.json({
      success: true,
      message: 'Transfer successful',
      senderBalance: sender.balance,
      recipientBalance: recipient.balance,
      transactionDetails: {
        from: sender.accountNumber,
        to: recipient.accountNumber,
        amount: amountNum
      }
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;