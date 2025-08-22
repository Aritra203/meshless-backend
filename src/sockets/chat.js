import { ChatMessage } from '../models/ChatMessage.js';
import { EmergencyMessage } from '../models/EmergencyMessage.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { peerDiscoveryService } from '../services/peerDiscoveryService.js';
import { nanoid } from 'nanoid';

export function initChat(io) {
  // Enhanced chat namespace with session support
  const chatNsp = io.of('/chat');
  chatNsp.on('connection', (socket) => {
    console.log('User connected to chat:', socket.userId);

    // Join user to their personal room for direct messages
    socket.join(`user:${socket.userId}`);

    // Handle joining a chat room
    socket.on('join-room', async ({ roomId }) => {
      try {
        socket.join(roomId);
        console.log(`User ${socket.userId} joined room: ${roomId}`);
        
        // If it's a session room, validate access
        if (roomId.startsWith('session-')) {
          const sessionId = roomId.replace('session-', '');
          const session = await Session.findOne({ sessionId });
          
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }
          
          // Check if user has access to this session
          const hasAccess = session.providerId?.toString() === socket.userId ||
                           session.consumerId?.toString() === socket.userId ||
                           session.connectedUsers?.includes(socket.userId);
          
          if (!hasAccess) {
            socket.emit('error', { message: 'Access denied to this session' });
            socket.leave(roomId);
            return;
          }
        }
        
        // Send message history
        const history = await ChatMessage.find({ room: roomId })
          .populate('fromUser', 'name')
          .sort({ createdAt: -1 })
          .limit(30)
          .lean();
        
        socket.emit('message-history', history.reverse());
        
        // Notify other users in the room
        socket.to(roomId).emit('user-joined', {
          userId: socket.userId,
          roomId
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle leaving a chat room
    socket.on('leave-room', ({ roomId }) => {
      socket.leave(roomId);
      console.log(`User ${socket.userId} left room: ${roomId}`);
      
      // Notify other users in the room
      socket.to(roomId).emit('user-left', {
        userId: socket.userId,
        roomId
      });
    });

    // Enhanced message sending
    socket.on('send-message', async (data) => {
      try {
        const { roomId, content, type = 'text', metadata } = data;
        
        if (!roomId || !content) {
          socket.emit('error', { message: 'Room ID and content are required' });
          return;
        }
        
        // Handle emergency messages differently
        if (roomId === 'emergency-global' || type === 'emergency') {
          const emergencyMessage = new EmergencyMessage({
            type: metadata?.emergencyType || 'alert',
            message: content,
            location: metadata?.location,
            severity: metadata?.severity || 'medium',
            reportedBy: socket.userId,
            status: 'active'
          });
          
          await emergencyMessage.save();
          await emergencyMessage.populate('reportedBy', 'name');
          
          // Broadcast emergency message to all users
          const emergencyData = {
            id: emergencyMessage._id,
            type: emergencyMessage.type,
            message: emergencyMessage.message,
            location: emergencyMessage.location,
            severity: emergencyMessage.severity,
            reportedBy: emergencyMessage.reportedBy._id,
            reportedByName: emergencyMessage.reportedBy.name,
            timestamp: emergencyMessage.createdAt,
            status: emergencyMessage.status
          };
          
          io.emit('emergency-alert', emergencyData);
          return;
        }
        
        // Save regular message to database
        const message = new ChatMessage({
          room: roomId,
          fromUser: socket.userId,
          content,
          type,
          metadata
        });
        
        await message.save();
        await message.populate('fromUser', 'name');
        
        // Broadcast message to room
        const messageData = {
          id: message._id,
          room: message.room,
          fromUser: message.fromUser._id,
          fromUserName: message.fromUser.name,
          content: message.content,
          timestamp: message.createdAt,
          type: message.type,
          metadata: message.metadata
        };
        
        chatNsp.to(roomId).emit('new-message', messageData);
        
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', ({ roomId }) => {
      socket.to(roomId).emit('user-typing', {
        userId: socket.userId,
        roomId
      });
    });

    socket.on('typing-stop', ({ roomId }) => {
      socket.to(roomId).emit('user-stopped-typing', {
        userId: socket.userId,
        roomId
      });
    });

    // Original chat handlers for backward compatibility
    socket.on('join', async ({ room, userId }) => {
      if (!room || !userId) return;
      socket.join(room);
      const history = await ChatMessage.find({ room }).sort({ createdAt: -1 }).limit(30).lean();
      socket.emit('history', history.reverse());
    });

    socket.on('message', async ({ room, userId, content }) => {
      if (!room || !userId || !content) return;
      const msg = await ChatMessage.create({ room, fromUser: userId, content });
      chatNsp.to(room).emit('message', { _id: msg._id, room, fromUser: userId, content, createdAt: msg.createdAt });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from chat:', socket.userId);
    });
  });

  // Mesh networking namespace for P2P signaling
  const meshNsp = io.of('/mesh');
  meshNsp.on('connection', (socket) => {
    console.log(`🔌 Mesh socket connected: ${socket.id}`);

    // Peer registration for mesh networking
    socket.on('register-peer', async (data) => {
      try {
        const { peerId, walletAddress, capabilities, location } = data;
        
        // Register peer in discovery service
        const peer = await peerDiscoveryService.registerPeer(
          peerId, 
          walletAddress, 
          capabilities, 
          location
        );
        
        // Associate socket with peer
        peerDiscoveryService.addPeerSocket(peerId, socket);
        socket.peerId = peerId;
        socket.walletAddress = walletAddress;
        
        socket.emit('peer-registered', { 
          success: true, 
          peer: peer.toObject() 
        });
        
        // Notify other peers of new peer
        socket.broadcast.emit('peer-joined', {
          peerId,
          capabilities,
          location
        });
        
        console.log(`✅ Peer registered: ${peerId}`);
      } catch (error) {
        socket.emit('peer-registered', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // Find internet providers
    socket.on('find-providers', async (data) => {
      try {
        const { location, requiredBandwidth } = data;
        const providers = await peerDiscoveryService.findNearbyProviders(location);
        
        socket.emit('providers-found', {
          success: true,
          providers: providers.map(p => ({
            peerId: p.peerId,
            capabilities: p.capabilities,
            location: p.location,
            reputation: p.reputation,
          }))
        });
      } catch (error) {
        socket.emit('providers-found', {
          success: false,
          error: error.message,
          providers: []
        });
      }
    });

    // WebRTC signaling for direct peer connections
    socket.on('webrtc-offer', (data) => {
      const { toPeer, offer } = data;
      const fromPeer = socket.peerId;
      
      // Store offer for later retrieval
      peerDiscoveryService.addSignalingOffer(fromPeer, toPeer, offer);
      
      // Forward to target peer if online
      const targetSocket = peerDiscoveryService.getPeerSocket(toPeer);
      if (targetSocket) {
        targetSocket.emit('webrtc-offer', {
          fromPeer,
          offer
        });
      }
    });

    socket.on('webrtc-answer', (data) => {
      const { toPeer, answer } = data;
      const fromPeer = socket.peerId;
      
      // Store answer
      peerDiscoveryService.addSignalingAnswer(fromPeer, toPeer, answer);
      
      // Forward to target peer
      const targetSocket = peerDiscoveryService.getPeerSocket(toPeer);
      if (targetSocket) {
        targetSocket.emit('webrtc-answer', {
          fromPeer,
          answer
        });
      }
    });

    socket.on('webrtc-ice-candidate', (data) => {
      const { toPeer, candidate } = data;
      const fromPeer = socket.peerId;
      
      // Forward ICE candidate to target peer
      const targetSocket = peerDiscoveryService.getPeerSocket(toPeer);
      if (targetSocket) {
        targetSocket.emit('webrtc-ice-candidate', {
          fromPeer,
          candidate
        });
      }
    });

    // Usage tracking for bandwidth sharing
    socket.on('usage-report', async (data) => {
      try {
        const { sessionId, bytesTransferred, duration, quality } = data;
        const peerId = socket.peerId;
        
        // Update peer stats
        await peerDiscoveryService.updatePeerStats(peerId, {
          dataShared: bytesTransferred,
          bandwidth: quality?.avgBandwidth,
          latency: quality?.avgLatency
        });
        
        socket.emit('usage-reported', { 
          success: true, 
          sessionId 
        });
        
        console.log(`📊 Usage reported by ${peerId}: ${bytesTransferred} bytes`);
      } catch (error) {
        socket.emit('usage-reported', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // Emergency communication (offline-first)
    socket.on('emergency-message', async (data) => {
      try {
        const messageId = nanoid();
        const fromPeer = socket.peerId;
        
        const message = new EmergencyMessage({
          messageId,
          fromPeer,
          toPeer: data.toPeer,
          content: data.content,
          priority: data.priority || 'medium',
          messageType: data.messageType || 'text',
          location: data.location,
          ttl: data.ttl || 24
        });
        
        await message.save();
        
        // Broadcast to all connected peers for mesh routing
        socket.broadcast.emit('emergency-message', {
          messageId,
          fromPeer,
          toPeer: data.toPeer,
          content: data.content,
          priority: data.priority,
          messageType: data.messageType,
          location: data.location,
          hops: []
        });
        
        socket.emit('message-sent', { 
          success: true, 
          messageId 
        });
        
        console.log(`🚨 Emergency message from ${fromPeer}: ${data.content}`);
      } catch (error) {
        socket.emit('message-sent', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // Connection quality monitoring
    socket.on('ping-test', (data) => {
      socket.emit('pong-test', {
        ...data,
        serverTime: Date.now()
      });
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 Mesh socket disconnected: ${socket.id}`);
      
      if (socket.peerId) {
        await peerDiscoveryService.unregisterPeer(socket.peerId);
        
        // Notify other peers
        socket.broadcast.emit('peer-left', {
          peerId: socket.peerId
        });
      }
    });
  });

  console.log('✅ Enhanced chat & mesh signaling initialized');
}
