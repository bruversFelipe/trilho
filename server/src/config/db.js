import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'trilho';

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Create a .env file (see .env.example).');
  }

  await mongoose.connect(uri, { dbName });
  console.log(`MongoDB connected (db: ${dbName})`);
}
