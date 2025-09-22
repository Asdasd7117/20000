import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = path.resolve();

// ملفات ثابتة
app.use(express.static(path.join(__dirname, "public")));

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// صفحة الغرفة
app.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// إعادة توجيه أي رابط آخر إلى index.html (ماعدا Socket.IO)
app.get("*", (req, res) => {
  if (!req.path.startsWith("/socket.io")) {
    res.sendFile(path.join(__dirname, "public/index.html"));
  }
});

// إدارة الغرف والمستخدمين
io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", socket.id);

    // استقبال الإشارات وإرسالها لكل شخص آخر في الغرفة
    socket.on("signal", (data) => {
      socket.to(roomId).emit("signal", { userId: socket.id, signal: data.signal });
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
