import { ChatMessage } from '../models/ChatMessage.js';

export function initChat(io) {
  const nsp = io.of('/chat');
  nsp.on('connection', (socket) => {
    socket.on('join', async ({ room, userId }) => {
      if (!room || !userId) return;
      socket.join(room);
      const history = await ChatMessage.find({ room }).sort({ createdAt: -1 }).limit(30).lean();
      socket.emit('history', history.reverse());
    });

    socket.on('message', async ({ room, userId, content }) => {
      if (!room || !userId || !content) return;
      const msg = await ChatMessage.create({ room, fromUser: userId, content });
      // send to room
      nsp.to(room).emit('message', { _id: msg._id, room, fromUser: userId, content, createdAt: msg.createdAt });
    });
  });
}
