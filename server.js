const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidV4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// الرابط الأساسي "/" → إنشاء غرفة جديدة وإرسال roomId عبر query
app.get("/", (req, res) => {
  const roomId = uuidV4();
  res.redirect(`/room?roomId=${roomId}`);
});

// فتح صفحة الغرفة
app.get("/room", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

// WebSocket
io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("offer", (data) => socket.to(data.room).emit("offer", { sdp: data.sdp, from: socket.id }));
  socket.on("answer", (data) => socket.to(data.room).emit("answer", { sdp: data.sdp, from: socket.id }));
  socket.on("candidate", (data) => socket.to(data.room).emit("candidate", { candidate: data.candidate, from: socket.id }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر شغال على البورت ${PORT}`));
