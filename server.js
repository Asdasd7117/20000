const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// يخدم index.html, room.html, css, js
app.use(express.static(path.join(__dirname, "/"))); 

// -------------------- إدارة الغرف --------------------
const rooms = {}; // تخزين الغرف مؤقتًا

// ضع رابط سيرفرك هنا
const SERVER_URL = process.env.SERVER_URL || "https://two0000-lxps.onrender.com";

app.get("/create-room", (req, res) => {
  const roomId = Math.random().toString(36).substr(2, 9);
  const token = Math.random().toString(36).substr(2, 15);
  rooms[roomId] = { token };

  // رابط مطلق
  const fullLink = `${SERVER_URL}/room.html?roomId=${roomId}&t=${token}`;

  res.json({
    roomId,
    token,
    link: fullLink
  });
});

// -------------------- WebSocket --------------------
io.on("connection", socket => {
  socket.on("join-room", ({ roomId, token }) => {
    const room = rooms[roomId];
    if (!room || room.token !== token) {
      socket.emit("room-error", "الغرفة غير موجودة أو التوكن غير صحيح");
      return;
    }
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", socket.id);

    socket.on("offer", data => socket.to(data.to).emit("offer", { from: socket.id, sdp: data.sdp }));
    socket.on("answer", data => socket.to(data.to).emit("answer", { from: socket.id, sdp: data.sdp }));
    socket.on("candidate", data => socket.to(data.to).emit("candidate", { from: socket.id, candidate: data.candidate }));
    socket.on("chat", data => io.to(roomId).emit("chat", data));
    socket.on("leave-room", () => {
      socket.leave(roomId);
      io.to(roomId).emit("user-left", socket.id);
    });
  });
});

// -------------------- تشغيل السيرفر --------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
