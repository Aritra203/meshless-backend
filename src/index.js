import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import providerRoutes from './routes/providerRoutes.js';
import consumerRoutes from './routes/consumerRoutes.js';
import gatewayRoutes from './routes/gatewayRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import meshRoutes from './routes/meshRoutes.js';
import blockchainRoutes from './routes/blockchainRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { initChat } from './sockets/chat.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));

app.get('/', (req, res) => res.json({ 
  ok: true, 
  name: 'meshless-backend', 
  version: '2.0.0',
  features: [
    'Mesh Networking & P2P Discovery',
    'Blockchain Rewards (Polygon)',
    'Emergency Communication',
    'Real-time Chat & Messaging',
    'Usage Tracking & Analytics',
    'WebRTC Signaling'
  ],
  time: new Date().toISOString() 
}));

// Original routes
app.use('/api/auth', authRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/consumer', consumerRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// New mesh networking routes
app.use('/api/mesh', meshRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/chat', chatRoutes);

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN },
  pingTimeout: 60000,
  pingInterval: 25000
});

initChat(io);

(async () => {
  await connectDB();
  server.listen(env.PORT, () => {
    console.log(`🚀 Meshless Backend v2.0.0 listening on :${env.PORT}`);
    console.log(`🔗 Features: Mesh + Blockchain + Emergency Communications`);
    console.log(`🌐 Network: ${env.MESH_NETWORK_ID}`);
    console.log(`⛓️  Blockchain: ${env.POLYGON_RPC_URL ? 'Connected' : 'Not configured'}`);
  });
})();
