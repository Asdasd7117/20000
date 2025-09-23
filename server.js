const express = require("express");
const { v4: uuidV4 } = require("uuid");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// إذا فتح المستخدم الرابط الرئيسي → أنشئ غرفة جديدة
app.get("/", (req, res) => {
  res.redirect(`/room/${uuidV4()}`);
});

// صفحة الغرفة
app.get("/room/:room", (req, res) => {
  res.sendFile(__dirname + "/public/room.html");
});

io.on("connection", socket => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId);

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
