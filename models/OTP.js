// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Transaction Schema for storing transaction history
const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['local', 'international', 'add_funds', 'received'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  recipientName: String,
  recipientAccount: String,
  senderName: String,
  senderAccount: String,
  swiftCode: String,
  ibanNumber: String,
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'completed'
  },
  estimatedCompletion: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  notes: String
});

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phoneNumber: String,
    inviteCode: String,
    homeAddress: String,
    workAddress: String,
    emiratesId: String,
    passport: String,
    accountPurpose: String,
    employerName: String,
    salary: String,
    balance: { type: Number, default: 0 },
    accountNumber: { type: String, required: true, unique: true }, // Required and unique
    cardNumber: { type: String, required: true, unique: true }, // Required and unique
    transactions: [transactionSchema],
  },
  { timestamps: true }
);
const otpSchema = new mongoose.Schema({
  otpKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  transactionType: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600  // Auto-delete after 10 minutes (600 seconds)
  }
});

// Index for automatic cleanup
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OTP = mongoose.model('OTP', otpSchema);


// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);