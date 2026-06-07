import mongoose from "mongoose";
import dotenv from "dotenv";
import chalk from "chalk";
import dns from "node:dns";
dotenv.config();

// Cache the connection promise so warm Vercel invocations reuse the existing connection
let connectionPromise = null;
const databaseName = process.env.MONGO_DB_NAME || "tajHRMS";
const dnsServers = process.env.MONGO_DNS_SERVERS?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers?.length) {
  dns.setServers(dnsServers);
}

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  if (connectionPromise) return connectionPromise;

  try {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      dbName: databaseName,
      maxPoolSize: 5,               // Small pool per serverless instance — each Vercel invocation has its own pool
      minPoolSize: 0,               // Don't hold idle connections between requests on serverless
      maxIdleTimeMS: 10000,         // Release unused connections after 10s to avoid exhausting Atlas limits
      serverSelectionTimeoutMS: 5000, // Fail fast (5s) if no MongoDB server is reachable
      connectTimeoutMS: 10000,      // Allow 10s for initial TCP + TLS + auth handshake
      socketTimeoutMS: 45000,       // Cover typical HRMS OLTP operations (payroll, attendance, etc.)
    });
    const conn = await connectionPromise;
    console.log(chalk.bgGreen(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`));
  } catch (error) {
    connectionPromise = null; // Reset so the next cold start can retry
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
