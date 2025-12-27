// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_here';

// ----------------- SIGNUP -----------------
router.post('/signup', async (req, res) => {
  try {
    const {
      email,
      password,
      phoneNumber,
      accountNumber, // Accept account number from user
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

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!accountNumber || accountNumber.trim() === '') {
      return res.status(400).json({ message: 'Account number is required' });
    }

    if (!cardNumber || cardNumber.trim() === '') {
      return res.status(400).json({ message: 'Card number is required' });
    }

    // Normalize inputs - trim whitespace
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedAccountNumber = accountNumber.trim();
    const normalizedCardNumber = cardNumber.trim();

    console.log('Normalized email:', JSON.stringify(normalizedEmail));
    console.log('Normalized account number:', JSON.stringify(normalizedAccountNumber));
    console.log('Normalized card number:', JSON.stringify(normalizedCardNumber));

    // Check if email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log('ERROR: Email already exists');
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if account number already exists
    const existingAccount = await User.findOne({ accountNumber: normalizedAccountNumber });
    if (existingAccount) {
      console.log('ERROR: Account number already exists');
      return res.status(400).json({ message: 'Account number already registered' });
    }

    // Check if card number already exists
    const existingCard = await User.findOne({ cardNumber: normalizedCardNumber });
    if (existingCard) {
      console.log('ERROR: Card number already exists');
      return res.status(400).json({ message: 'Card number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    console.log('Password hashed successfully');

    const newUser = new User({
      email: normalizedEmail,
      password: hashedPassword,
      phoneNumber,
      accountNumber: normalizedAccountNumber, // User-provided account number
      cardNumber: normalizedCardNumber, // User-provided card number
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

export default router;