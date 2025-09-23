const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// أي رابط يبدأ بـ /room يرجع ملف room.html
app.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

// Socket.IO
const rooms = {}; // لتخزين مستخدمي كل غرفة

io.on("connection", socket => {
  console.log("🔌 مستخدم متصل:", socket.id);

  socket.on("join-room", roomId => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);
    console.log(`📌 المستخدم ${socket.id} دخل الغرفة: ${roomId}`);

    // إخطار المستخدمين الآخرين
    socket.to(roomId).emit("user-joined", socket.id);

    // Relay signals بين جميع المستخدمين
    socket.on("signal", data => {
      socket.to(data.to).emit("signal", {
        from: socket.id,
        signal: data.signal
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ المستخدم ${socket.id} خرج`);
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      socket.to(roomId).emit("user-left", socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر شغال على البورت ${PORT}`));
