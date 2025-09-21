const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

const rooms = {};
const socketToRoom = {};

io.on("connection", socket => {
  console.log("🔌 connected:", socket.id);

  socket.on("join-room", ({ roomId, token }) => {
    const room = rooms[roomId];
    if (!room || room.token !== token) return socket.emit("room-error", "الرابط غير صالح");
    if (room.users.length >= 2) return socket.emit("room-error", "الغرفة ممتلئة");

    room.users.push(socket.id);
    socket.join(roomId);
    socketToRoom[socket.id] = roomId;

    const others = room.users.filter(id => id !== socket.id);
    socket.emit("joined", { roomId, selfId: socket.id, others });
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("offer", ({ to, sdp }) => io.to(to).emit("offer", { from: socket.id, sdp }));
  socket.on("answer", ({ to, sdp }) => io.to(to).emit("answer", { from: socket.id, sdp }));
  socket.on("candidate", ({ to, candidate }) => io.to(to).emit("candidate", { from: socket.id, candidate }));
  socket.on("chat", ({ roomId, text, name }) => socket.to(roomId).emit("chat", { from: socket.id, text, name }));

  socket.on("disconnect", () => {
    const roomId = socketToRoom[socket.id];
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;

    room.users = room.users.filter(u => u !== socket.id);
    if (room.users.length === 0) delete rooms[roomId];
    else socket.to(roomId).emit("user-left", socket.id);
    delete socketToRoom[socket.id];
  });
});

// إنشاء غرفة جديدة
app.get("/create-room", (req, res) => {
  const roomId = nanoid(6);
  const token = nanoid(12);
  rooms[roomId] = { roomId, token, users: [] };
  res.json({ roomId, token, link: `https://YOUR-RENDER-SERVER/room/${roomId}?t=${token}` });
});

app.use("/room", express.static("public")); // اختياري للاختبار
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
