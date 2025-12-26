// backend/routes/wallet.js
import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

const router = express.Router();

console.log('✅ Wallet routes loaded');

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

// Configure email transporter with safety checks
let transporter = null;
let emailEnabled = false;

try {
  // Check if email credentials exist
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify email configuration
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email verification failed:', error.message);
        console.log('⚠️ Email is disabled. OTP will work without email.');
        emailEnabled = false;
      } else {
        console.log('✅ Email server is ready to send messages');
        emailEnabled = true;
      }
    });
  } else {
    console.log('⚠️ Email credentials not configured. OTP will work without email.');
    console.log('   Add EMAIL_USER and EMAIL_PASSWORD to .env to enable emails');
  }
} catch (error) {
  console.error('❌ Email setup error:', error.message);
  console.log('⚠️ Email is disabled. OTP will work without email.');
}

// Generate 4-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Send OTP email (safe - won't crash if email fails)
const sendOTPEmail = async (email, otp, transactionType, amount) => {
  if (!transporter || !emailEnabled) {
    console.log('⚠️ Email not configured, skipping email send');
    return false;
  }

  try {
    const mailOptions = {
      from: `"Emirates NBD" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Your Transaction OTP Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #2563EB, #1E40AF); padding: 30px; text-align: center; }
            .logo { color: white; font-size: 28px; font-weight: bold; margin: 0; }
            .content { padding: 40px 30px; }
            .otp-box { background: #F3F4F6; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0; border: 2px dashed #2563EB; }
            .otp-code { font-size: 48px; font-weight: bold; color: #2563EB; letter-spacing: 8px; margin: 10px 0; }
            .otp-label { color: #6B7280; font-size: 14px; margin-bottom: 10px; }
            .details { background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E5E7EB; }
            .detail-label { color: #6B7280; font-size: 14px; }
            .detail-value { color: #111827; font-weight: 600; font-size: 14px; }
            .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .warning-text { color: #92400E; font-size: 13px; margin: 0; }
            .footer { background: #F9FAFB; padding: 20px 30px; text-align: center; color: #6B7280; font-size: 12px; }
            .timer { color: #EF4444; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">Emirates NBD</h1>
              <p style="color: #E0E7FF; margin: 10px 0 0 0;">Secure Banking</p>
            </div>
            
            <div class="content">
              <h2 style="color: #111827; margin-top: 0;">Transaction Verification Required</h2>
              <p style="color: #4B5563; line-height: 1.6;">
                You have requested to complete a transaction. Please use the OTP code below to verify and complete your transaction.
              </p>
              
              <div class="otp-box">
                <div class="otp-label">YOUR OTP CODE</div>
                <div class="otp-code">${otp}</div>
                <p style="color: #6B7280; font-size: 13px; margin: 15px 0 0 0;">
                  Valid for <span class="timer">5 minutes</span>
                </p>
              </div>
              
              <div class="details">
                <h3 style="margin-top: 0; color: #111827; font-size: 16px;">Transaction Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Transaction Type</span>
                  <span class="detail-value">${transactionType.toUpperCase()}</span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                  <span class="detail-label">Amount</span>
                  <span class="detail-value">د.إ ${amount}</span>
                </div>
              </div>
              
              <div class="warning">
                <p class="warning-text">
                  ⚠️ <strong>Security Notice:</strong> Never share this OTP with anyone. Emirates NBD staff will never ask for your OTP code.
                </p>
              </div>
              
              <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">
                If you did not request this transaction, please contact our customer support immediately.
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 5px 0;">© 2024 Emirates NBD. All rights reserved.</p>
              <p style="margin: 5px 0;">This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending OTP email:', error.message);
    return false;
  }
};

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

// ✅ Generate OTP for transaction
router.post('/generate-otp', async (req, res) => {
  console.log('🔐 POST /api/add/generate-otp called');
  console.log('Request body:', req.body);
  
  try {
    const { userId, transactionType, amount } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpKey = `${userId}_${Date.now()}`;
    
    // Store OTP with expiry (5 minutes)
    otpStore.set(otpKey, {
      otp,
      userId,
      transactionType,
      amount,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    console.log(`🔐 OTP Generated: ${otp}`);
    console.log(`   User: ${user.email || 'No email'}`);
    console.log(`   Transaction: ${transactionType}`);
    console.log(`   Amount: د.إ${amount}`);

    // Try to send email (optional - won't fail if email is not configured)
    let emailSent = false;
    if (user.email && emailEnabled) {
      emailSent = await sendOTPEmail(user.email, otp, transactionType, amount);
    }

    // Always return success
    res.json({
      success: true,
      message: emailSent 
        ? `OTP sent to ${user.email.substring(0, 3)}***` 
        : 'OTP generated (check console)',
      otpKey,
      email: user.email ? user.email.substring(0, 3) + '***' : undefined,
      // Show OTP in response for testing
      otp: otp, // Always show OTP for testing
      expiresIn: 300
    });

  } catch (error) {
    console.error('❌ Generate OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ✅ Verify OTP
router.post('/verify-otp', async (req, res) => {
  console.log('✅ POST /api/add/verify-otp called');
  
  try {
    const { otpKey, otp } = req.body;

    if (!otpKey || !otp) {
      return res.status(400).json({ message: 'OTP key and code are required' });
    }

    const otpData = otpStore.get(otpKey);

    if (!otpData) {
      return res.status(400).json({ 
        message: 'Invalid or expired OTP',
        expired: true 
      });
    }

    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(400).json({ 
        message: 'OTP has expired',
        expired: true 
      });
    }

    // Verify OTP
    if (otpData.otp !== otp.toString()) {
      return res.status(400).json({ 
        message: 'Invalid OTP code',
        expired: false 
      });
    }

    console.log(`✅ OTP Verified for user ${otpData.userId}`);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      userId: otpData.userId
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Add funds with OTP verification
// ✅ Add funds with OTP verification (combined)
router.post('/add-funds', async (req, res) => {
  console.log('💰 POST /api/add/add-funds called');
  
  let session = null;
  
  try {
    const { userId, amount, otpKey, otp } = req.body;
    const amountNum = Number(amount);

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!otpKey || !otp) {
      return res.status(400).json({ message: 'OTP verification required' });
    }

    if (!amountNum || amountNum <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Verify OTP
    const otpData = otpStore.get(otpKey);
    
    if (!otpData) {
      console.log('❌ OTP key not found:', otpKey);
      console.log('Available keys:', Array.from(otpStore.keys()));
      return res.status(401).json({ 
        message: 'OTP session expired. Please request a new OTP.',
        expired: true 
      });
    }

    if (otpData.userId !== userId) {
      return res.status(401).json({ message: 'OTP verification failed' });
    }

    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(401).json({ 
        message: 'OTP has expired',
        expired: true 
      });
    }

    // Verify OTP code
    if (otpData.otp !== otp.toString()) {
      return res.status(401).json({ 
        message: 'Invalid OTP code',
        expired: false 
      });
    }

    // OTP verified, delete it
    otpStore.delete(otpKey);
    console.log('✅ OTP verified successfully');

    session = await mongoose.startSession();
    session.startTransaction();

    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    user.balance = (user.balance || 0) + amountNum;
    
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'add_funds',
      amount: amountNum,
      status: 'completed',
      notes: 'Funds added to account',
      createdAt: new Date()
    });
    
    await user.save({ session });
    await session.commitTransaction();

    console.log(`✅ Added د.إ${amountNum}. New balance: د.إ${user.balance}`);

    res.json({ 
      success: true,
      balance: user.balance,
      message: `Successfully added د.إ${amountNum}` 
    });
    
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('Add funds error:', error);
    res.status(500).json({ message: 'Server errorr', error: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

// ✅ Transfer with OTP verification
// Fix for the transfer endpoint in wallet.js

// ✅ Transfer with OTP verification - FIXED VERSION
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
      ibanNumber,
      otpKey,
      otp  // ADD THIS - was missing!
    } = req.body;
    
    const amountNum = Number(amount);

    console.log('💸 Transfer request:', {
      type: transferType,
      from: fromUserId,
      to: toAccountNumber,
      amount: amountNum,
      otpKey: otpKey ? '✓' : '✗',
      otp: otp ? '✓' : '✗'  // ADD THIS
    });

    // Validation
    if (!fromUserId || !toAccountNumber || !amountNum) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    if (!otpKey || !otp) {  // FIXED: Check for both otpKey AND otp
      return res.status(400).json({ 
        success: false,
        message: 'OTP verification required' 
      });
    }

    if (!recipientName) {
      return res.status(400).json({ 
        success: false,
        message: 'Recipient name is required' 
      });
    }

    if (amountNum <= 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Amount must be greater than 0' 
      });
    }

    // FIXED: Verify OTP properly
    const otpData = otpStore.get(otpKey);
    
    if (!otpData) {
      console.log('❌ OTP key not found:', otpKey);
      console.log('Available OTP keys:', Array.from(otpStore.keys()));
      return res.status(401).json({ 
        success: false,
        message: 'OTP session expired. Please request a new OTP.',
        expired: true 
      });
    }

    if (otpData.userId !== fromUserId) {
      return res.status(401).json({ 
        success: false,
        message: 'OTP verification failed - user mismatch' 
      });
    }

    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(401).json({ 
        success: false,
        message: 'OTP has expired',
        expired: true 
      });
    }

    // FIXED: Verify OTP code
    if (otpData.otp !== otp.toString()) {
      console.log('❌ OTP mismatch:', { expected: otpData.otp, received: otp });
      return res.status(401).json({ 
        success: false,
        message: 'Invalid OTP code',
        expired: false 
      });
    }

    console.log('✅ OTP verified successfully');
    
    // Delete OTP after successful verification
    otpStore.delete(otpKey);

    if (transferType === 'international' && !swiftCode?.trim()) {
      return res.status(400).json({ 
        success: false,
        message: 'SWIFT code is required for international transfers' 
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const sender = await User.findById(fromUserId).session(session);
    if (!sender) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Sender not found' 
      });
    }

    if ((sender.balance || 0) < amountNum) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        message: 'Insufficient balance',
        currentBalance: sender.balance || 0,
        required: amountNum
      });
    }

    if (transferType === 'local') {
      const recipient = await User.findOne({ accountNumber: toAccountNumber }).session(session);
      
      if (!recipient) {
        await session.abortTransaction();
        return res.status(404).json({ 
          success: false,
          message: 'Recipient account not found' 
        });
      }

      if (sender._id.equals(recipient._id)) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false,
          message: 'Cannot transfer to your own account' 
        });
      }

      sender.balance = (sender.balance || 0) - amountNum;
      recipient.balance = (recipient.balance || 0) + amountNum;

      sender.transactions = sender.transactions || [];
      sender.transactions.push({
        type: 'local',
        amount: -amountNum,
        recipientName,
        recipientAccount: toAccountNumber,
        status: 'completed',
        createdAt: new Date()
      });

      recipient.transactions = recipient.transactions || [];
      recipient.transactions.push({
        type: 'received',
        amount: amountNum,
        senderName: sender.email,
        senderAccount: sender.accountNumber,
        status: 'completed',
        createdAt: new Date()
      });

      await sender.save({ session });
      await recipient.save({ session });
      await session.commitTransaction();

      console.log(`✅ Local Transfer: د.إ${amountNum}`);

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
      // International transfer
      const estimatedCompletion = new Date();
      estimatedCompletion.setDate(estimatedCompletion.getDate() + 2);

      sender.balance = (sender.balance || 0) - amountNum;

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

      await sender.save({ session });
      await session.commitTransaction();

      console.log(`✅ International Transfer: د.إ${amountNum}`);

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
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('❌ Transfer error:', error);
    console.error('Error stack:', error.stack);  // ADD THIS for better debugging
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

// Clean up expired OTPs
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (now > value.expiresAt) {
      otpStore.delete(key);
      console.log(`🗑️ Expired OTP cleaned: ${key}`);
    }
  }
}, 60000);

export default router;