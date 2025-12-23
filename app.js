import dotenv from 'dotenv';
dotenv.config(); // must be first

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import WalletRoutes from './walletRoutes/add.js';
import authRoutes from './routes/auth.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/add', WalletRoutes);

const PORT = process.env.PORT || 5000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected');

  // Start server AFTER DB connection
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1); // Stop the app if DB fails
});
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '✅ Server is running!',
    time: new Date().toISOString()
  });
});

export default app;
