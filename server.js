import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const app = express();
const server = createServer(app);
const io = new Server(server);

// ملفات الواجهة
app.use(express.static("public"));

// الصفحة الرئيسية → تعطي index.html
app.get(["/", "/room/:roomId"], (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

// Socket.IO
io.on("connection", socket => {
  console.log("🔌 مستخدم متصل:", socket.id);

  socket.on("join-room", roomId => {
    console.log(`📥 ${socket.id} انضم إلى الغرفة ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", socket.id);

    socket.on("signal", data => {
      console.log(`📡 إشارة من ${socket.id} إلى ${data.userId}`, data.signal?.type || data.signal?.candidate ? "candidate" : "unknown");
      io.to(data.userId).emit("signal", { userId: socket.id, signal: data.signal });
    });

    socket.on("disconnect", () => {
      console.log(`❌ ${socket.id} غادر الغرفة ${roomId}`);
      socket.to(roomId).emit("user-disconnected", socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
