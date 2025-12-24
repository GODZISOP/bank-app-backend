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
    console.log('Raw password:', JSON.stringify(password));
    console.log('Password length (raw):', password?.length);
    console.log('Password charCodes:', password ? [...password].map(c => c.charCodeAt(0)) : 'N/A');

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    // Normalize inputs - trim whitespace
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    console.log('Normalized email:', JSON.stringify(normalizedEmail));
    console.log('Normalized password:', JSON.stringify(normalizedPassword));
    console.log('Normalized password length:', normalizedPassword.length);
    console.log('Normalized password charCodes:', [...normalizedPassword].map(c => c.charCodeAt(0)));

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log('ERROR: Email already exists');
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    console.log('Password hashed successfully');
    console.log('Hash (first 60 chars):', hashedPassword.substring(0, 60));

    const newUser = new User({
      email: normalizedEmail,
      password: hashedPassword,
      phoneNumber,
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

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: newUser._id, email: newUser.email },
    });
  } catch (err) {
    console.error('SIGNUP ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----------------- LOGIN -----------------
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

    // ✅ Return ALL fields from database
    res.json({
      token,
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        email: user.email,
        accountNumber: user.accountNumber,
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
      balance: user.balance,
      hasAccountNumber: !!user.accountNumber,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


export default router;