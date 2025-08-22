import dotenv from 'dotenv';
dotenv.config();
export const env = {
  PORT: process.env.PORT || 8080,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/meshless',
  JWT_SECRET: process.env.JWT_SECRET || 'supersecretchangeme',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@123',
  
  // Blockchain configuration
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
  BLOCKCHAIN_PRIVATE_KEY: process.env.BLOCKCHAIN_PRIVATE_KEY,
  MESH_CREDITS_CONTRACT_ADDRESS: process.env.MESH_CREDITS_CONTRACT_ADDRESS,
  
  // Mesh networking
  MESH_NETWORK_ID: process.env.MESH_NETWORK_ID || 'meshless-testnet',
  DEFAULT_REWARD_RATE: parseFloat(process.env.DEFAULT_REWARD_RATE) || 1.0, // MESH per GB
  MAX_PEER_CONNECTIONS: parseInt(process.env.MAX_PEER_CONNECTIONS) || 50,
  
  // Emergency settings
  EMERGENCY_MESSAGE_TTL: parseInt(process.env.EMERGENCY_MESSAGE_TTL) || 24, // hours
  SOS_BROADCAST_RADIUS: parseInt(process.env.SOS_BROADCAST_RADIUS) || 50, // km
};
