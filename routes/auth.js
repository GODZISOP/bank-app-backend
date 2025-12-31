// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_here';

// Email configuration for verification codes
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Temporary storage for verification codes (use Redis in production)
const verificationCodes = new Map();

// ----------------- SIGNUP -----------------
router.post('/signup', async (req, res) => {
  try {
    const {
      email,
      password,
      phoneNumber,
      accountNumber,
      cardNumber,
      homeAddress,
      workAddress,
      emiratesId,
      passport,
      accountPurpose,
      employerName,
      salary,
      inviteCode,
    } = req.body;

    console.log('=== SIGNUP ATTEMPT ===');
    console.log('Raw email:', JSON.stringify(email));
    console.log('Account Number:', JSON.stringify(accountNumber));
    console.log('Card Number:', JSON.stringify(cardNumber));

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!accountNumber || accountNumber.trim() === '') {
      return res.status(400).json({ message: 'Account number is required' });
    }

    if (!cardNumber || cardNumber.trim() === '') {
      return res.status(400).json({ message: 'Card number is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedAccountNumber = accountNumber.trim();
    const normalizedCardNumber = cardNumber.trim();

    console.log('Normalized email:', JSON.stringify(normalizedEmail));
    console.log('Normalized account number:', JSON.stringify(normalizedAccountNumber));
    console.log('Normalized card number:', JSON.stringify(normalizedCardNumber));

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log('ERROR: Email already exists');
      return res.status(400).json({ message: 'Email already registered' });
    }

    const existingAccount = await User.findOne({ accountNumber: normalizedAccountNumber });
    if (existingAccount) {
      console.log('ERROR: Account number already exists');
      return res.status(400).json({ message: 'Account number already registered' });
    }

    const existingCard = await User.findOne({ cardNumber: normalizedCardNumber });
    if (existingCard) {
      console.log('ERROR: Card number already exists');
      return res.status(400).json({ message: 'Card number already registered' });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    console.log('Password hashed successfully');

    const newUser = new User({
      email: normalizedEmail,
      password: hashedPassword,
      phoneNumber,
      accountNumber: normalizedAccountNumber,
      cardNumber: normalizedCardNumber,
      homeAddress,
      workAddress,
      emiratesId,
      passport,
      accountPurpose,
      employerName,
      salary,
      inviteCode,
    });

    await newUser.save();
    console.log('SUCCESS: User registered:', normalizedEmail);
    console.log('Account Number:', newUser.accountNumber);
    console.log('Card Number:', newUser.cardNumber);

    res.status(201).json({
      message: 'User registered successfully',
      user: { 
        id: newUser._id, 
        email: newUser.email,
        accountNumber: newUser.accountNumber,
        cardNumber: newUser.cardNumber
      },
    });
  } catch (err) {
    console.error('SIGNUP ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----------------- LOGIN -----------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'your_secret_here',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        email: user.email,
        accountNumber: user.accountNumber,
        cardNumber: user.cardNumber,
        balance: user.balance || 0,
        phoneNumber: user.phoneNumber,
        homeAddress: user.homeAddress,
        workAddress: user.workAddress,
        emiratesId: user.emiratesId,
        passport: user.passport,
        accountPurpose: user.accountPurpose,
        employerName: user.employerName,
        salary: user.salary,
        inviteCode: user.inviteCode,
        createdAt: user.createdAt,
      }
    });

    console.log('✅ User logged in:', user.email);
    console.log('Account Number:', user.accountNumber);
    console.log('Card Number:', user.cardNumber);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----------------- SEND VERIFICATION CODE -----------------

// DEBUG: Get user info (remove in production)
router.get('/me/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      _id: user._id.toString(),
      email: user.email,
      accountNumber: user.accountNumber,
      cardNumber: user.cardNumber,
      balance: user.balance,
      hasAccountNumber: !!user.accountNumber,
      hasCardNumber: !!user.cardNumber,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Sending code to:', email);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Generate 4-digit code
    const code = crypto.randomInt(1000, 9999).toString();
    
    // Store code with 10 min expiry
    verificationCodes.set(normalizedEmail, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    console.log(`📝 Code: ${code} for ${normalizedEmail}`);

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: 'PIN Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">PIN Reset Request</h2>
          <p style="font-size: 16px; color: #6B7280;">Your verification code is:</p>
          <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4F46E5; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
          </div>
          <p style="font-size: 14px; color: #6B7280;">This code expires in 10 minutes.</p>
        </div>
      `
    });

    console.log(`✅ Code sent to ${normalizedEmail}`);

    res.json({ 
      success: true, 
      message: 'Code sent' 
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ----------------- VERIFY CODE -----------------
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    const normalizedEmail = email.trim().toLowerCase();
    const storedData = verificationCodes.get(normalizedEmail);

    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'No code found' 
      });
    }

    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(normalizedEmail);
      return res.status(400).json({ 
        success: false, 
        message: 'Code expired' 
      });
    }

    if (storedData.code !== code.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid code' 
      });
    }

    console.log(`✅ Code verified for ${normalizedEmail}`);

    res.json({ 
      success: true, 
      message: 'Code verified' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Verification failed' 
    });
  }
});

// ----------------- RESET PIN -----------------
router.post('/reset-pin', async (req, res) => {
  try {
    const { email, newPin } = req.body;

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ 
        success: false, 
        message: 'PIN must be 4 digits' 
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Clean up code
    verificationCodes.delete(normalizedEmail);

    console.log(`✅ PIN reset for ${normalizedEmail}`);

    res.json({ 
      success: true, 
      message: 'PIN reset successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reset PIN' 
    });
  }
});

export default router;