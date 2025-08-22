import express from 'express';
import { ChatMessage } from '../models/ChatMessage.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { auth } from '../middleware/auth.js';
import { nanoid } from 'nanoid';

const router = express.Router();

// Get chat rooms for a user
router.get('/rooms', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get session-based chat rooms (user's active sessions)
    const sessions = await Session.find({
      $or: [
        { providerId: userId },
        { consumerId: userId },
        { connectedUsers: userId }
      ],
      status: 'active'
    }).populate('providerId consumerId', 'name');

    const sessionRooms = sessions.map(session => ({
      id: `session-${session.sessionId}`,
      name: session.title || `Session with ${session.providerId?.name || 'Provider'}`,
      type: 'session',
      participants: [
        session.providerId?.toString(),
        session.consumerId?.toString(),
        ...(session.connectedUsers || [])
      ].filter(Boolean),
      lastMessage: null, // TODO: Get last message
      unreadCount: 0, // TODO: Calculate unread count
      createdAt: session.createdAt
    }));

    // TODO: Add emergency and community rooms
    const emergencyRooms = [{
      id: 'emergency-global',
      name: 'Emergency Alerts',
      type: 'emergency',
      participants: [], // All users
      lastMessage: null,
      unreadCount: 0,
      createdAt: new Date()
    }];

    const allRooms = [...sessionRooms, ...emergencyRooms];

    res.json({
      success: true,
      rooms: allRooms
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get direct message conversations
router.get('/direct-messages', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get distinct conversations where user is a participant
    const conversations = await ChatMessage.aggregate([
      {
        $match: {
          room: { $regex: '^dm-' }, // Direct message rooms start with 'dm-'
          $or: [
            { fromUser: userId },
            { room: { $regex: userId } } // Room contains user ID
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$room',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 }
        }
      }
    ]);

    const formattedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Extract participant IDs from room name (format: dm-userId1-userId2)
        const roomParts = conv._id.split('-');
        const participants = roomParts.slice(1); // Remove 'dm' prefix
        
        // Get participant names
        const users = await User.find({ 
          _id: { $in: participants } 
        }).select('name');

        return {
          id: conv._id,
          participants: participants,
          participantNames: users.map(u => u.name),
          lastMessage: conv.lastMessage,
          unreadCount: 0, // TODO: Calculate unread count
          createdAt: conv.lastMessage.createdAt
        };
      })
    );

    res.json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start a direct message conversation
router.post('/start-dm', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;
    
    if (!targetUserId || targetUserId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target user'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found'
      });
    }

    // Create room ID (consistent regardless of who starts the conversation)
    const sortedIds = [userId, targetUserId].sort();
    const roomId = `dm-${sortedIds[0]}-${sortedIds[1]}`;

    res.json({
      success: true,
      roomId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get message history for a room
router.get('/history/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;
    
    let query = { room: roomId };
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }
    
    const messages = await ChatMessage.find(query)
      .populate('fromUser', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const formattedMessages = messages.reverse().map(msg => ({
      id: msg._id,
      room: msg.room,
      fromUser: msg.fromUser._id,
      fromUserName: msg.fromUser.name,
      content: msg.content,
      timestamp: msg.createdAt,
      type: msg.type || 'text'
    }));

    res.json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send a message (REST endpoint, WebSocket is preferred)
router.post('/send', auth, async (req, res) => {
  try {
    const { room, content, type = 'text', metadata } = req.body;
    const userId = req.user.id;
    
    if (!room || !content) {
      return res.status(400).json({
        success: false,
        error: 'Room and content are required'
      });
    }

    const message = new ChatMessage({
      room,
      fromUser: userId,
      content,
      type,
      metadata
    });

    await message.save();
    await message.populate('fromUser', 'name');

    res.json({
      success: true,
      message: {
        id: message._id,
        room: message.room,
        fromUser: message.fromUser._id,
        fromUserName: message.fromUser.name,
        content: message.content,
        timestamp: message.createdAt,
        type: message.type
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mark messages as read
router.post('/mark-read/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    
    // TODO: Implement read receipts
    // For now, just return success
    
    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
