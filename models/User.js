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

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);