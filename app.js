import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import WalletRoutes from './WalletRoutes/add.js';
import authRoutes from './routes/auth.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/add', WalletRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '✅ Server is running!',
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

// Debug: Check if MONGO_URI exists
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment variables!');
  process.exit(1);
}

console.log('🔄 Connecting to MongoDB...');

// MongoDB connection (removed deprecated options)
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

export default app;