const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema de Mensagens
const messageSchema = new mongoose.Schema({
  sender: String,
  recipient: String, // 'group' se for para todos, ou username se for privado
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Setup Socket.io e Redis Adapter para escalabilidade horizontal
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis adapter for Socket.io enabled');
});

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Middleware de Autenticação para WebSockets
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = decoded; // { id, username }
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username} (Socket ID: ${socket.id})`);
  
  // Entra em uma sala com o próprio nome para receber mensagens privadas
  socket.join(socket.user.username);
  
  // Entra na sala geral (para mensagens em grupo)
  socket.join('group');

  socket.on('sendMessage', async (data) => {
    // data: { recipient: 'username' | 'group', content: 'hello' }
    const { recipient, content } = data;
    
    // Persistência da mensagem no MongoDB
    const msg = new Message({
      sender: socket.user.username,
      recipient,
      content
    });
    await msg.save();

    const messageData = {
      sender: socket.user.username,
      recipient,
      content,
      timestamp: msg.timestamp
    };

    // Comunicação Push
    if (recipient === 'group') {
      io.to('group').emit('receiveMessage', messageData);
    } else {
      // Mensagem privada 1:1
      io.to(recipient).emit('receiveMessage', messageData);
      // Envia para si mesmo também, para aparecer na interface
      socket.emit('receiveMessage', messageData);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);
  });
});

// REST API para buscar o histórico de mensagens
app.get('/api/chat/history', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const username = decoded.username;
    const { contact } = req.query; // se contact for 'group', pega histórico do grupo

    let messages;
    if (contact === 'group') {
      messages = await Message.find({ recipient: 'group' }).sort({ timestamp: 1 }).limit(100);
    } else {
      // 1:1 com o 'contact'
      messages = await Message.find({
        $or: [
          { sender: username, recipient: contact },
          { sender: contact, recipient: username }
        ]
      }).sort({ timestamp: 1 }).limit(100);
    }
    res.json(messages);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const port = process.env.PORT || 3002;
server.listen(port, () => {
  console.log(`Chat service running on port ${port}`);
});
