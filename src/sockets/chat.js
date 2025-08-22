import { ChatMessage } from '../models/ChatMessage.js';
import { EmergencyMessage } from '../models/EmergencyMessage.js';
import { peerDiscoveryService } from '../services/peerDiscoveryService.js';
import { nanoid } from 'nanoid';

export function initChat(io) {
  // Original chat namespace
  const chatNsp = io.of('/chat');
  chatNsp.on('connection', (socket) => {
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
