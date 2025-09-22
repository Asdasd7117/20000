import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// لو دخل المستخدم الرابط الأساسي /
app.get("/", (req, res) => {
  const roomId = uuidv4(); // إنشاء معرف فريد للغرفة
  res.redirect(`/room/${roomId}`);
});

// صفحة الغرفة
app.get("/room/:roomId", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

// سوكت لإدارة الغرف
io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", socket.id);

    // تمرير رسائل WebRTC
    socket.on("signal", (data) => {
      io.to(data.userId).emit("signal", {
        userId: socket.id,
        signal: data.signal,
      });
    });

    // مغادرة المستخدم
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", socket.id);
    });
  });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
