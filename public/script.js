const socket = io();

// معرف الغرفة من الرابط
let roomId = window.location.pathname.split("/")[2];

// Peer Connections
const peers = {};
const videoGrid = document.getElementById("videos");

// إعداد الفيديو المحلي
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
  addVideoStream(stream, "أنا");

  socket.emit("join-room", roomId);

  socket.on("user-connected", (userId) => {
    connectToNewUser(userId, stream);
  });
});

// التعامل مع WebRTC
function connectToNewUser(userId, stream) {
  const peer = new RTCPeerConnection();
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));

  const video = document.createElement("video");
  video.autoplay = true;

  peer.ontrack = (event) => {
    video.srcObject = event.streams[0];
    addVideoStream(video.srcObject, `👤 ${userId}`);
  };

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { userId, signal: event.candidate });
    }
  };

  peers[userId] = peer;
}

// استقبال الإشارات
socket.on("signal", (data) => {
  const peer = peers[data.userId];
  if (peer) {
    peer.addIceCandidate(new RTCIceCandidate(data.signal));
  }
});

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
});

// إضافة الفيديو للشاشة
function addVideoStream(stream, label) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;

  const container = document.createElement("div");
  container.appendChild(video);
  container.appendChild(document.createElement("br"));
  const nameTag = document.createElement("span");
  nameTag.innerText = label;
  container.appendChild(nameTag);

  videoGrid.appendChild(container);
}

// رابط الغرفة
document.getElementById("roomLink").value = window.location.href;

function copyLink() {
  navigator.clipboard.writeText(window.location.href);
  alert("تم نسخ الرابط ✅");
}

// دردشة نصية (بسيطة)
function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value;
  if (msg.trim()) {
    const chatBox = document.getElementById("chatBox");
    chatBox.innerHTML += `<p><b>أنا:</b> ${msg}</p>`;
    input.value = "";
  }
}
