const socket = io();
const videoGrid = document.getElementById("videos");
const peers = {};

// إنشاء UUID لغرفة الزائر تلقائيًا إذا لم يكن الرابط يحتوي معرف
let roomId = window.location.pathname.split("/")[2];
if (!roomId) {
  roomId = crypto.randomUUID(); // كل زائر له UUID مختلف
  window.history.replaceState(null, "Room", `/room/${roomId}`);
}

// عرض رابط الغرفة في الصفحة
document.getElementById("roomLink").value = window.location.href;

// إعداد الفيديو المحلي
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    addVideoStream(stream, "أنا");

    socket.emit("join-room", roomId);

    socket.on("user-connected", userId => {
      connectToNewUser(userId, stream);
    });

    socket.on("signal", data => {
      if (peers[data.userId]) {
        peers[data.userId].addIceCandidate(new RTCIceCandidate(data.signal));
      }
    });

    socket.on("user-disconnected", userId => {
      if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
      }
    });
  })
  .catch(err => console.error("خطأ في الوصول للكاميرا أو الميكروفون:", err));

// دوال WebRTC
function connectToNewUser(userId, stream) {
  const peer = new RTCPeerConnection();
  peers[userId] = peer;

  stream.getTracks().forEach(track => peer.addTrack(track, stream));

  const video = document.createElement("video");
  video.autoplay = true;

  peer.ontrack = e => addVideoStream(e.streams[0], `👤 ${userId}`);
  peer.onicecandidate = e => {
    if (e.candidate) socket.emit("signal", { userId, signal: e.candidate });
  };

  peer.createOffer().then(offer => peer.setLocalDescription(offer))
      .then(() => socket.emit("signal", { userId, signal: peer.localDescription }));
}

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

// نسخ رابط الغرفة
function copyLink() {
  navigator.clipboard.writeText(window.location.href);
  alert("تم نسخ الرابط ✅");
}
