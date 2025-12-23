import mongoose from "mongoose";

let cached = global.mongoose;

// Initialize cache if it doesn't exist
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  // Return existing connection if available
  if (cached.conn) {
    console.log("♻️ Using cached MongoDB connection");
    return cached.conn;
  }

  // Create new connection if no promise exists
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering
    };

    console.log("🔄 Creating new MongoDB connection...");
    
    cached.promise = mongoose.connect(process.env.MONGO_URI, opts)
      .then((mongoose) => {
        console.log("✅ MongoDB connected");
        return mongoose;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // Reset on error
    console.error("❌ MongoDB connection error:", err);
    throw err; // Throw instead of process.exit
  }

  return cached.conn;
};