const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const roomStore = require('./store');
const { generateRoomCode, generateUsername } = require('./utils');

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet());
app.disable('x-powered-by'); // Helmet does this, but being explicit is fine

// Strict CORS
// Strict CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://tempu.netlify.app",
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || !process.env.NODE_ENV) {
      // In dev, sometimes origin might be different? 
      // safest to just check list. 
      // Actually, let's just pass the array to cors directly if we want simple, 
      // but sending an array to `origin` works too. 
      return callback(null, true);
    } else {
      // Check if it matches allowedOrigins
      // Simple array check
      if (allowedOrigins.includes(origin)) return callback(null, true);
      else return callback(new Error('Not allowed by CORS'));
    }
  }
};

// Actually express cors supports array directly
app.use(cors({ origin: allowedOrigins }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// Rate Limiting
const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts
  message: { error: 'Too many rooms created from this IP, please try again later.' }
});

const joinRoomLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 attempts
  message: { error: 'Too many join attempts from this IP, please try again later.' }
});

app.use(express.json());

// --- API Endpoints ---

// Create Room
app.post('/api/rooms', createRoomLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    let roomCode = generateRoomCode();

    // Ensure uniqueness (simple retry mechanism)
    let attempts = 0;
    while (roomStore.getRoom(roomCode) && attempts < 5) {
      roomCode = generateRoomCode();
      attempts++;
    }

    if (roomStore.getRoom(roomCode)) {
      return res.status(500).json({ error: 'Failed to generate unique room code' });
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    roomStore.createRoom(roomCode, passwordHash);
    res.json({ roomCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join Room (Validation only)
app.post('/api/rooms/join', joinRoomLimiter, async (req, res) => {
  try {
    const { roomCode, password } = req.body;
    const room = roomStore.getRoom(roomCode);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check password if room is protected
    if (room.passwordHash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required', passwordRequired: true });
      }
      const isMatch = await bcrypt.compare(password, room.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password', passwordRequired: true });
      }
    }

    // Assign a temp username for the response (client will send this back on socket join, or socket will generate one? 
    // Actually, socket events usually handle the final join. This HTTP step is just to validate entry.
    // Let's just return success.
    res.json({ success: true, roomCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.send('Temp Telegram Backend is running');
});

// --- Socket.IO Events ---

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', async ({ roomCode, password }) => {
    // Re-validate room existence
    const room = roomStore.getRoom(roomCode);
    if (!room) {
      socket.emit('error', 'Room does not exist');
      return;
    }

    // STRICT PASSWORD CHECK
    if (room.passwordHash) {
      if (!password) {
        socket.emit('error', 'Password required');
        return;
      }
      const isMatch = await bcrypt.compare(password, room.passwordHash);
      if (!isMatch) {
        socket.emit('error', 'Incorrect password');
        return;
      }
    }

    const username = generateUsername();
    roomStore.joinRoom(roomCode, socket.id, username);
    socket.join(roomCode);

    // Notify user
    socket.emit('joined', {
      roomCode,
      username,
      messages: room.messages,
      users: Array.from(room.users.values())
    });

    // Notify room
    socket.to(roomCode).emit('user_joined', { username, system: true });
    io.to(roomCode).emit('room_users', Array.from(room.users.values()));
  });

  socket.on('send_message', ({ roomCode, text }) => {
    const room = roomStore.getRoom(roomCode);
    if (!room) return;

    // Verify sender is in room
    const senderName = room.users.get(socket.id);
    if (!senderName) return;

    const message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      sender: senderName,
      text: text.replace(/</g, '&lt;'), // Basic Server-Side Sanitization
      timestamp: Date.now(),
      type: 'text'
    };

    roomStore.addMessage(roomCode, message);
    io.to(roomCode).emit('receive_message', message);
  });

  socket.on('clear_chat', ({ roomCode }) => {
    console.log(`Received clear_chat request for room: ${roomCode} from user: ${socket.id}`);
    const room = roomStore.getRoom(roomCode);
    if (!room) {
      console.log(`Room ${roomCode} not found during clear_chat`);
      return;
    }

    // Optional: Check if user is authorized? 
    // For this app, anyone in the room can clear it.

    const result = roomStore.clearMessages(roomCode);
    if (result) {
      io.to(roomCode).emit('chat_cleared');
      console.log(`Chat cleared for room: ${roomCode}`);

      // Notify as system message too
      const sysMsg = { id: Date.now(), text: 'Chat history was cleared', type: 'system' };
      io.to(roomCode).emit('receive_message', sysMsg);
    } else {
      console.log(`Failed to clear messages for room: ${roomCode}`);
    }
  });

  socket.on('disconnect', () => {
    const result = roomStore.leaveRoom(socket.id);
    if (result) {
      const { roomCode, username } = result;
      io.to(roomCode).emit('user_left', { username, system: true });

      const room = roomStore.getRoom(roomCode);
      if (room) {
        io.to(roomCode).emit('room_users', Array.from(room.users.values()));
      }

      console.log(`User ${username} disconnected from ${roomCode}`);
    }
  });
});

// Cleanup inactive rooms every minute
setInterval(() => {
  const removed = roomStore.cleanup();
  if (removed > 0) {
    console.log(`Cleaned up ${removed} inactive rooms`);
  }
}, 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
