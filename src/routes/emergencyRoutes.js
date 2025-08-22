import express from 'express';
import { EmergencyMessage } from '../models/EmergencyMessage.js';
import { Peer } from '../models/Peer.js';
import { nanoid } from 'nanoid';

const router = express.Router();

// Send emergency message
router.post('/send', async (req, res) => {
  try {
    const { 
      fromPeer, 
      toPeer, 
      content, 
      priority = 'medium', 
      messageType = 'text',
      location,
      ttl = 24 
    } = req.body;
    
    if (!fromPeer || !content) {
      return res.status(400).json({
        success: false,
        error: 'From peer and content are required'
      });
    }
    
    const messageId = nanoid();
    const message = new EmergencyMessage({
      messageId,
      fromPeer,
      toPeer,
      content,
      priority,
      messageType,
      location,
      ttl
    });
    
    await message.save();
    
    // In a real implementation, this would trigger mesh routing
    // For now, we'll just store it and let WebSocket handle broadcast
    
    res.json({
      success: true,
      message: {
        messageId: message.messageId,
        fromPeer: message.fromPeer,
        toPeer: message.toPeer,
        content: message.content,
        priority: message.priority,
        messageType: message.messageType,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get messages for a peer
router.get('/peer/:peerId', async (req, res) => {
  try {
    const { peerId } = req.params;
    const { priority, messageType, limit = 50 } = req.query;
    
    let query = {
      $or: [
        { toPeer: peerId },
        { toPeer: null }, // broadcast messages
        { fromPeer: peerId } // sent messages
      ],
      // Only get messages within TTL
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24 hours default
      }
    };
    
    if (priority) {
      query.priority = priority;
    }
    
    if (messageType) {
      query.messageType = messageType;
    }
    
    const messages = await EmergencyMessage.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      messages,
      count: messages.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get emergency messages by location (for nearby assistance)
router.post('/nearby', async (req, res) => {
  try {
    const { location, radius = 10, priority } = req.body; // radius in km
    
    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        success: false,
        error: 'Location with lat/lng is required'
      });
    }
    
    let query = {
      location: { $exists: true },
      // Only emergency and high priority messages for location-based search
      priority: { $in: ['high', 'emergency'] },
      delivered: false,
      createdAt: {
        $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) // last 12 hours
      }
    };
    
    if (priority) {
      query.priority = priority;
    }
    
    const messages = await EmergencyMessage.find(query);
    
    // Filter by distance (simple calculation)
    const nearbyMessages = messages.filter(msg => {
      if (!msg.location?.lat || !msg.location?.lng) return false;
      
      const distance = calculateDistance(
        location.lat, location.lng,
        msg.location.lat, msg.location.lng
      );
      
      return distance <= radius;
    });
    
    res.json({
      success: true,
      messages: nearbyMessages,
      count: nearbyMessages.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mark message as delivered
router.post('/:messageId/delivered', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deliveredBy } = req.body;
    
    const message = await EmergencyMessage.findOneAndUpdate(
      { messageId },
      { 
        delivered: true, 
        deliveredAt: new Date(),
        $push: {
          hops: {
            peerId: deliveredBy,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    res.json({
      success: true,
      message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get emergency statistics
router.get('/stats', async (req, res) => {
  try {
    const totalMessages = await EmergencyMessage.countDocuments();
    const deliveredMessages = await EmergencyMessage.countDocuments({ delivered: true });
    const emergencyMessages = await EmergencyMessage.countDocuments({ priority: 'emergency' });
    
    const messagesByType = await EmergencyMessage.aggregate([
      {
        $group: {
          _id: '$messageType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const messagesByPriority = await EmergencyMessage.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const recentMessages = await EmergencyMessage.find({
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24 hours
      }
    }).countDocuments();
    
    res.json({
      success: true,
      stats: {
        total: totalMessages,
        delivered: deliveredMessages,
        emergency: emergencyMessages,
        recent24h: recentMessages,
        deliveryRate: totalMessages > 0 ? (deliveredMessages / totalMessages * 100).toFixed(2) : 0,
        messagesByType,
        messagesByPriority
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Broadcast SOS signal
router.post('/sos', async (req, res) => {
  try {
    const { fromPeer, location, details = 'SOS - Need immediate assistance' } = req.body;
    
    if (!fromPeer || !location) {
      return res.status(400).json({
        success: false,
        error: 'From peer and location are required for SOS'
      });
    }
    
    const messageId = nanoid();
    const sosMessage = new EmergencyMessage({
      messageId,
      fromPeer,
      toPeer: null, // broadcast
      content: details,
      priority: 'emergency',
      messageType: 'sos',
      location,
      ttl: 48 // SOS messages last longer
    });
    
    await sosMessage.save();
    
    res.json({
      success: true,
      sosId: messageId,
      message: 'SOS signal broadcasted',
      messageDetails: {
        messageId,
        fromPeer,
        location,
        priority: 'emergency',
        messageType: 'sos'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = degToRad(lat2 - lat1);
  const dLng = degToRad(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function degToRad(deg) {
  return deg * (Math.PI/180);
}

export default router;
