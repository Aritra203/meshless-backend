import { Peer } from '../models/Peer.js';

class PeerDiscoveryService {
  constructor() {
    this.activePeers = new Map(); // peerId -> socket
    this.peerConnections = new Map(); // peerId -> { offers: [], answers: [] }
  }

  async registerPeer(peerId, walletAddress, capabilities = {}, location = {}) {
    try {
      let peer = await Peer.findOne({ peerId });
      
      if (peer) {
        // Update existing peer
        peer.isOnline = true;
        peer.lastSeen = new Date();
        peer.capabilities = { ...peer.capabilities, ...capabilities };
        peer.location = { ...peer.location, ...location };
      } else {
        // Create new peer
        peer = new Peer({
          peerId,
          walletAddress,
          isOnline: true,
          capabilities: {
            canProvideInternet: false,
            canReceiveInternet: true,
            bandwidth: 0,
            latency: 0,
            ...capabilities
          },
          location
        });
      }

      await peer.save();
      console.log(`🔗 Peer registered: ${peerId}`);
      return peer;
    } catch (error) {
      console.error('❌ Peer registration failed:', error.message);
      throw error;
    }
  }

  async unregisterPeer(peerId) {
    try {
      await Peer.findOneAndUpdate(
        { peerId },
        { isOnline: false, lastSeen: new Date() }
      );
      
      this.activePeers.delete(peerId);
      this.peerConnections.delete(peerId);
      
      console.log(`🔌 Peer disconnected: ${peerId}`);
    } catch (error) {
      console.error('❌ Peer unregistration failed:', error.message);
    }
  }

  async findNearbyProviders(location, radius = 50) {
    try {
      const providers = await Peer.find({
        isOnline: true,
        'capabilities.canProvideInternet': true,
        'capabilities.bandwidth': { $gt: 0 },
      }).sort({ reputation: -1, 'capabilities.bandwidth': -1 });

      // Simple distance filtering (in real app, use proper geo queries)
      return providers.filter(peer => {
        if (!peer.location?.lat || !peer.location?.lng) return true;
        const distance = this.calculateDistance(
          location.lat, location.lng,
          peer.location.lat, peer.location.lng
        );
        return distance <= radius;
      });
    } catch (error) {
      console.error('❌ Find providers failed:', error.message);
      return [];
    }
  }

  async findOptimalProvider(location, requiredBandwidth = 1) {
    try {
      const providers = await this.findNearbyProviders(location);
      
      // Score providers based on bandwidth, latency, reputation
      const scoredProviders = providers.map(peer => {
        const bandwidthScore = Math.min(peer.capabilities.bandwidth / requiredBandwidth, 1);
        const latencyScore = Math.max(0, 1 - (peer.capabilities.latency / 1000));
        const reputationScore = Math.min(peer.reputation / 100, 1);
        
        const totalScore = (bandwidthScore * 0.4) + (latencyScore * 0.3) + (reputationScore * 0.3);
        
        return { ...peer.toObject(), score: totalScore };
      });

      return scoredProviders.sort((a, b) => b.score - a.score)[0] || null;
    } catch (error) {
      console.error('❌ Find optimal provider failed:', error.message);
      return null;
    }
  }

  addPeerSocket(peerId, socket) {
    this.activePeers.set(peerId, socket);
  }

  removePeerSocket(peerId) {
    this.activePeers.delete(peerId);
  }

  getPeerSocket(peerId) {
    return this.activePeers.get(peerId);
  }

  getAllOnlinePeers() {
    return Array.from(this.activePeers.keys());
  }

  // WebRTC signaling helpers
  addSignalingOffer(fromPeer, toPeer, offer) {
    if (!this.peerConnections.has(toPeer)) {
      this.peerConnections.set(toPeer, { offers: [], answers: [] });
    }
    this.peerConnections.get(toPeer).offers.push({ fromPeer, offer, timestamp: Date.now() });
  }

  addSignalingAnswer(fromPeer, toPeer, answer) {
    if (!this.peerConnections.has(toPeer)) {
      this.peerConnections.set(toPeer, { offers: [], answers: [] });
    }
    this.peerConnections.get(toPeer).answers.push({ fromPeer, answer, timestamp: Date.now() });
  }

  getSignalingData(peerId) {
    return this.peerConnections.get(peerId) || { offers: [], answers: [] };
  }

  clearSignalingData(peerId) {
    this.peerConnections.delete(peerId);
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degToRad(lat2 - lat1);
    const dLng = this.degToRad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  }

  degToRad(deg) {
    return deg * (Math.PI/180);
  }

  async updatePeerStats(peerId, stats) {
    try {
      await Peer.findOneAndUpdate(
        { peerId },
        {
          $set: {
            'capabilities.bandwidth': stats.bandwidth || 0,
            'capabilities.latency': stats.latency || 0,
            lastSeen: new Date(),
          },
          $inc: {
            totalDataShared: stats.dataShared || 0,
            totalDataConsumed: stats.dataConsumed || 0,
          }
        }
      );
    } catch (error) {
      console.error('❌ Update peer stats failed:', error.message);
    }
  }
}

export const peerDiscoveryService = new PeerDiscoveryService();
