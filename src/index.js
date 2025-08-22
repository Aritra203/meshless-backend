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
import { initChat } from './sockets/chat.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));

app.get('/', (req, res) => res.json({ ok: true, name: 'meshless-backend', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/consumer', consumerRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN } });
initChat(io);

(async () => {
  await connectDB();
  server.listen(env.PORT, () => {
    console.log(`🚀 API listening on :${env.PORT}`);
  });
})();
