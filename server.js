const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// أي رابط /room/:roomId يعيد room.html
app.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

// تخزين المستخدمين في كل غرفة
const rooms = {};

io.on("connection", socket => {
  console.log("🔌 مستخدم متصل:", socket.id);

  socket.on("join-room", roomId => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    // إخطار المستخدمين الآخرين
    socket.to(roomId).emit("user-joined", socket.id);

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

server.listen(process.env.PORT || 3000, () => console.log("🚀 السيرفر شغال"));
