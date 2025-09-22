const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// ملفات ثابتة (HTML/CSS/JS)
app.use(express.static('public'));

// أي زائر يدخل / يحصل على UUID جديد
app.get('/', (req, res) => {
  const roomId = uuidv4(); // توليد UUID جديد
  res.redirect(`/room/${roomId}`); // إعادة توجيه صحيحة
});

// صفحة الغرفة
app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تخزين الغرف
const rooms = {};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    socket.join(roomId);

    socket.to(roomId).emit('user-connected', socket.id);

    socket.on('signal', (data) => {
      io.to(data.to).emit('signal', { ...data, from: socket.id });
    });

    socket.on('chat-message', msg => {
      socket.to(roomId).emit('chat-message', { user: socket.id, msg });
    });

    socket.on('disconnect', () => {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      socket.to(roomId).emit('user-disconnected', socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
