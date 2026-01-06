// backend/models/OTP.js - CREATE THIS NEW FILE
import mongoose from 'mongoose';

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
    required: true,
    index: true
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
    expires: 300 // ✅ Changed to 300 seconds (5 minutes)
  }
});

// MongoDB TTL index
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

export default mongoose.model('OTP', otpSchema);
