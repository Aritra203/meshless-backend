import express from 'express';
import { peerDiscoveryService } from '../services/peerDiscoveryService.js';
import { blockchainService } from '../services/blockchainService.js';
import { Peer } from '../models/Peer.js';
import { Session } from '../models/Session.js';
import { nanoid } from 'nanoid';

const router = express.Router();

// Get all online peers
router.get('/peers', async (req, res) => {
  try {
    const peers = await Peer.find({ isOnline: true }).select('-__v');
    res.json({
      success: true,
      peers,
      count: peers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get peer details
router.get('/peers/:peerId', async (req, res) => {
  try {
    const peer = await Peer.findOne({ peerId: req.params.peerId });
    if (!peer) {
      return res.status(404).json({
        success: false,
        error: 'Peer not found'
      });
    }
    
    res.json({
      success: true,
      peer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Find optimal provider for internet access
router.post('/find-provider', async (req, res) => {
  try {
    const { location, requiredBandwidth = 1 } = req.body;
    
    const provider = await peerDiscoveryService.findOptimalProvider(
      location, 
      requiredBandwidth
    );
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'No suitable provider found'
      });
    }
    
    res.json({
      success: true,
      provider: {
        peerId: provider.peerId,
        capabilities: provider.capabilities,
        location: provider.location,
        reputation: provider.reputation,
        score: provider.score
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start a new internet sharing session
router.post('/sessions/start', async (req, res) => {
  try {
    const { providerId, consumerId } = req.body;
    
    if (!providerId || !consumerId) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID and Consumer ID are required'
      });
    }
    
    const sessionId = nanoid();
    const session = new Session({
      sessionId,
      providerId,
      consumerId,
      status: 'active'
    });
    
    await session.save();
    
    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        providerId: session.providerId,
        consumerId: session.consumerId,
        startTime: session.startTime,
        status: session.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// End a session and calculate rewards
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { bytesTransferred, quality } = req.body;
    
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Session is not active'
      });
    }
    
    // Calculate session metrics
    const endTime = new Date();
    const duration = (endTime - session.startTime) / 1000; // seconds
    const qualityScore = quality ? 
      (quality.uptime || 1) * 
      Math.min(1, (quality.avgBandwidth || 1) / 1) * 
      Math.max(0.1, 1 - (quality.avgLatency || 100) / 1000) : 1;
    
    // Calculate reward
    const rewardAmount = await blockchainService.estimateReward(
      bytesTransferred || 0, 
      qualityScore
    );
    
    // Update session
    session.endTime = endTime;
    session.duration = duration;
    session.bytesTransferred = bytesTransferred || 0;
    session.quality = quality;
    session.rewardAmount = rewardAmount;
    session.status = 'completed';
    
    await session.save();
    
    // Get provider's wallet address for reward
    const provider = await Peer.findOne({ peerId: session.providerId });
    if (provider && provider.walletAddress) {
      // Send blockchain reward (async)
      blockchainService.rewardUser(
        provider.walletAddress, 
        rewardAmount, 
        `Internet sharing session ${sessionId}`
      ).then(result => {
        if (result.success) {
          session.rewardPaid = true;
          session.txHash = result.txHash;
          session.save();
        }
      }).catch(err => {
        console.error('❌ Blockchain reward failed:', err.message);
      });
    }
    
    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        duration,
        bytesTransferred: session.bytesTransferred,
        rewardAmount,
        qualityScore
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session details
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get peer's session history
router.get('/peers/:peerId/sessions', async (req, res) => {
  try {
    const { peerId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const sessions = await Session.find({
      $or: [
        { providerId: peerId },
        { consumerId: peerId }
      ]
    })
    .sort({ startTime: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    res.json({
      success: true,
      sessions,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get network statistics
router.get('/stats', async (req, res) => {
  try {
    const totalPeers = await Peer.countDocuments();
    const onlinePeers = await Peer.countDocuments({ isOnline: true });
    const providers = await Peer.countDocuments({ 
      isOnline: true, 
      'capabilities.canProvideInternet': true 
    });
    
    const totalSessions = await Session.countDocuments();
    const activeSessions = await Session.countDocuments({ status: 'active' });
    
    const totalDataShared = await Peer.aggregate([
      { $group: { _id: null, total: { $sum: '$totalDataShared' } } }
    ]);
    
    const avgReputation = await Peer.aggregate([
      { $group: { _id: null, avg: { $avg: '$reputation' } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        peers: {
          total: totalPeers,
          online: onlinePeers,
          providers
        },
        sessions: {
          total: totalSessions,
          active: activeSessions
        },
        network: {
          totalDataShared: totalDataShared[0]?.total || 0,
          avgReputation: avgReputation[0]?.avg || 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
