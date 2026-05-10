import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

export const connectDB = async () => {
  if (!MONGODB_URI) {
    console.warn('⚠️ [MongoDB] MONGODB_URI is not set in environment variables. Database features disabled.');
    return;
  }

  mongoose.set('bufferCommands', false); // Disable buffering so errors surface immediately

  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    
    mongoose.connection.on('error', err => {
      console.error('[MongoDB] Connection dropped or error:', err);
    });

  } catch (error) {
    console.error(`[MongoDB] Connection Error: ${(error as Error).message}`);
    console.warn('⚠️ Please ensure that your IP (or 0.0.0.0/0) is whitelisted in MongoDB Atlas Network Access.');
  }
};
