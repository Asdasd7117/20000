import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// صفحة البداية و أي رابط /room/:roomId → تعرض index.html
app.get(["/", "/room/:roomId"], (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

// Socket.IO
io.on("connection", socket => {
  socket.on("join-room", roomId => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", socket.id);

    socket.on("signal", data => {
      io.to(data.userId).emit("signal", { userId: socket.id, signal: data.signal });
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
