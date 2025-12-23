// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
  },
  { timestamps: true }
);

// REMOVED THE PRE-SAVE HOOK - We're hashing in the route instead
// This prevents double hashing

// Generate account number before saving (only if it doesn't exist)
userSchema.pre('save', async function (next) {
  // Only generate account number, do NOT hash password here
  if (!this.accountNumber) {
    this.accountNumber = generateAccountNumber();
  }
  next();
});

// Compare password method (you can use this in routes instead of bcrypt.compare directly)
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

export default mongoose.model('User', userSchema);