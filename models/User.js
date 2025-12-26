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
    accountNumber: { type: String, unique: true },
cardNumber: { type: String, unique: true, sparse: true },
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

// Generate account number and card number before saving
userSchema.pre('save', async function (next) {
  // Only generate account number if it doesn't exist
  if (!this.accountNumber) {
    this.accountNumber = generateAccountNumber();
  }
  
  // Only generate card number if it doesn't exist
  if (!this.cardNumber) {
    this.cardNumber = generateCardNumber();
  }
  
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Helper function to generate realistic account number
function generateAccountNumber() {
  // Example format: AE12 3456 7890 123456
  return (
    'AE' +
    Math.floor(10 + Math.random() * 89) +
    ' ' +
    Math.floor(1000 + Math.random() * 9000) +
    ' ' +
    Math.floor(1000 + Math.random() * 9000) +
    ' ' +
    Math.floor(100000 + Math.random() * 900000)
  );
}

// Helper function to generate realistic card number
function generateCardNumber() {
  // Example format: 1784 3510 0008 4859 (16 digits)
  const firstGroup = Math.floor(1000 + Math.random() * 9000); // 4 digits starting with 1-9
  const secondGroup = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const thirdGroup = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const fourthGroup = Math.floor(1000 + Math.random() * 9000); // 4 digits
  
  return `${firstGroup} ${secondGroup} ${thirdGroup} ${fourthGroup}`;
}

export default mongoose.model('User', userSchema);