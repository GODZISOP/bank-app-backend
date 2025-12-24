// backend/routes/wallet.js
import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const router = express.Router();

console.log('✅ Wallet routes loaded');

// Auth middleware
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id || decoded._id;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Get user balance (with auth)
router.get('/balance', authMiddleware, async (req, res) => {
  console.log('📊 GET /api/add/balance called');
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

// ✅ FIXED: Add funds with retry safety
router.post('/add-funds', async (req, res) => {
  console.log('💰 POST /api/add/add-funds called');
  console.log('Body:', req.body);
  
  let session = null;
  
  try {
    const { userId, amount } = req.body;
    const amountNum = Number(amount);

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!amountNum || amountNum <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Start transaction session for safety
    session = await mongoose.startSession();
    session.startTransaction();

    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Update balance
    user.balance = (user.balance || 0) + amountNum;
    
    // Record transaction
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'add_funds',
      amount: amountNum,
      status: 'completed',
      notes: 'Funds added to account',
      createdAt: new Date()
    });
    
    // Save with transaction
    await user.save({ session });
    
    // Commit transaction
    await session.commitTransaction();

    console.log(`✅ Added ৳${amountNum} to user ${userId}. New balance: ৳${user.balance}`);

    res.json({ 
      success: true,
      balance: user.balance,
      message: `Successfully added ৳${amountNum}` 
    });
    
  } catch (error) {
    // Rollback on error
    if (session) {
      await session.abortTransaction();
      console.log('❌ Transaction rolled back');
    }
    console.error('Add funds error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

// ✅ FIXED: Transfer with transaction safety
router.post('/transfer', async (req, res) => {
  let session = null;
  
  try {
    const { 
      fromUserId, 
      toAccountNumber, 
      amount,
      transferType = 'local',
      recipientName,
      swiftCode,
      ibanNumber
    } = req.body;
    
    const amountNum = Number(amount);

    console.log('💸 Transfer request:', {
      type: transferType,
      from: fromUserId,
      to: toAccountNumber,
      amount: amountNum,
      recipientName,
      swiftCode: swiftCode ? '✓' : '✗',
      ibanNumber: ibanNumber ? '✓' : '✗'
    });

    // Basic validation
    if (!fromUserId || !toAccountNumber || !amountNum) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!recipientName) {
      return res.status(400).json({ message: 'Recipient name is required' });
    }

    if (amountNum <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    // International transfer validation
    if (transferType === 'international') {
      if (!swiftCode) {
        return res.status(400).json({ message: 'SWIFT code is required for international transfers' });
      }
      // Relaxed validation - accept any SWIFT code length
      if (!swiftCode.trim()) {
        return res.status(400).json({ message: 'SWIFT code cannot be empty' });
      }
    }

    // ✅ START TRANSACTION SESSION
    session = await mongoose.startSession();
    session.startTransaction();

    // Find sender with session
    const sender = await User.findById(fromUserId).session(session);
    if (!sender) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Sender not found' });
    }

    // Check balance
    if ((sender.balance || 0) < amountNum) {
      await session.abortTransaction();
      return res.status(400).json({ 
        message: 'Insufficient balance',
        currentBalance: sender.balance || 0,
        required: amountNum
      });
    }

    // Process based on transfer type
    if (transferType === 'local') {
      // ========== LOCAL TRANSFER - INSTANT ==========
      const recipient = await User.findOne({ accountNumber: toAccountNumber }).session(session);
      
      if (!recipient) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'Recipient account not found' });
      }

      // Check if sending to self
      if (sender._id.equals(recipient._id)) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Cannot transfer to your own account' });
      }

      // Perform instant transfer
      sender.balance = (sender.balance || 0) - amountNum;
      recipient.balance = (recipient.balance || 0) + amountNum;

      // Record transaction in sender's history
      sender.transactions = sender.transactions || [];
      sender.transactions.push({
        type: 'local',
        amount: -amountNum,
        recipientName,
        recipientAccount: toAccountNumber,
        status: 'completed',
        createdAt: new Date()
      });

      // Record transaction in recipient's history
      recipient.transactions = recipient.transactions || [];
      recipient.transactions.push({
        type: 'received',
        amount: amountNum,
        senderName: sender.email,
        senderAccount: sender.accountNumber,
        status: 'completed',
        createdAt: new Date()
      });

      // Save both users in transaction
      await sender.save({ session });
      await recipient.save({ session });
      
      // Commit transaction
      await session.commitTransaction();

      console.log(`✅ Local Transfer: ${sender.accountNumber} → ${recipient.accountNumber}: ৳${amountNum}`);

      return res.json({
        success: true,
        message: 'Transfer successful',
        transferType: 'local',
        senderBalance: sender.balance,
        transactionDetails: {
          from: sender.accountNumber,
          to: recipient.accountNumber,
          recipientName,
          amount: amountNum,
          status: 'completed',
          timestamp: new Date().toISOString()
        }
      });

    } else {
      // ========== INTERNATIONAL TRANSFER - PENDING ==========
      const estimatedCompletion = new Date();
      estimatedCompletion.setDate(estimatedCompletion.getDate() + 2);

      // Deduct from sender (amount already includes 2% charges from frontend)
      sender.balance = (sender.balance || 0) - amountNum;

      // Record transaction as pending
      sender.transactions = sender.transactions || [];
      sender.transactions.push({
        type: 'international',
        amount: -amountNum,
        recipientName,
        recipientAccount: toAccountNumber,
        swiftCode,
        ibanNumber: ibanNumber || null,
        status: 'pending',
        estimatedCompletion,
        notes: 'International transfer processing',
        createdAt: new Date()
      });

      // Save with transaction
      await sender.save({ session });
      
      // Commit transaction
      await session.commitTransaction();

      console.log(`✅ International Transfer Initiated:`);
      console.log(`   From: ${sender.accountNumber}`);
      console.log(`   To: ${toAccountNumber}`);
      console.log(`   SWIFT: ${swiftCode}`);
      console.log(`   IBAN: ${ibanNumber || 'N/A'}`);
      console.log(`   Amount: ৳${amountNum}`);
      console.log(`   New Balance: ৳${sender.balance}`);
      console.log(`   Estimated: ${estimatedCompletion.toLocaleDateString()}`);

      return res.json({
        success: true,
        message: 'International transfer initiated successfully',
        transferType: 'international',
        senderBalance: sender.balance,
        transactionDetails: {
          from: sender.accountNumber,
          to: toAccountNumber,
          recipientName,
          amount: amountNum,
          swiftCode,
          ibanNumber: ibanNumber || null,
          status: 'pending',
          estimatedCompletion: estimatedCompletion.toISOString(),
          timestamp: new Date().toISOString(),
          note: 'Transfer typically completes in 1-3 business days'
        }
      });
    }

  } catch (error) {
    // Rollback on any error
    if (session) {
      await session.abortTransaction();
      console.log('❌ Transaction rolled back');
    }
    console.error('❌ Transfer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

// Get transaction history
router.get('/transactions', authMiddleware, async (req, res) => {
  console.log('📜 GET /api/add/transactions called');
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Sort transactions by date (newest first)
    const transactions = (user.transactions || []).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    res.json({ 
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;