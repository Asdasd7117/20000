const socket = io();

// استخراج roomId من الرابط أو إنشاء جديد
let roomId;
const pathParts = window.location.pathname.split("/");

if (pathParts[1] === "room" && pathParts[2]) {
  roomId = pathParts[2];  // عند الدخول على رابط غرفة
} else {
  roomId = crypto.randomUUID(); // رابط جديد
  window.location.href = `/room/${roomId}`;
}

// عرض الرابط للزائر
document.getElementById("roomLink").value = window.location.href;

const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
myVideo.muted = true;

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  addVideoStream(myVideo, stream);

  socket.emit("join-room", roomId, socket.id);

  socket.on("user-connected", userId => {
    console.log("User connected:", userId);
    // هنا تضيف PeerJS لو تحب
  });
});

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}
