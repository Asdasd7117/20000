const socket = io();
const videoGrid = document.getElementById("videos");
const peers = {};

// استخراج roomId من الرابط
let roomId = window.location.pathname.split("/")[2];
if (!roomId) {
  roomId = crypto.randomUUID();
  window.history.replaceState(null, "Room", `/room/${roomId}`);
}

// عرض الرابط
document.getElementById("roomLink").value = window.location.href;

// أول خطوة: الحصول على MediaStream قبل الانضمام للغرفة
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    addVideoStream(stream, "أنا");

    // الانضمام للغرفة بعد تجهيز الفيديو
    socket.emit("join-room", roomId);

    // استقبال مستخدمين جدد
    socket.on("user-connected", userId => connectToNewUser(userId, stream));

    // استقبال إشارات WebRTC
    socket.on("signal", data => {
      if (!peers[data.userId]) return;

      const peer = peers[data.userId];
      if (data.signal.type === "offer") {
        peer.setRemoteDescription(new RTCSessionDescription(data.signal))
          .then(() => peer.createAnswer())
          .then(answer => peer.setLocalDescription(answer))
          .then(() => {
            socket.emit("signal", { userId: data.userId, signal: peer.localDescription });
          });
      } else if (data.signal.type === "answer") {
        peer.setRemoteDescription(new RTCSessionDescription(data.signal));
      } else if (data.signal.candidate) {
        peer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
      }
    });

    // المستخدم يغادر
    socket.on("user-disconnected", userId => {
      if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
      }
    });
  })
  .catch(err => console.error("خطأ في الوصول للكاميرا أو الميكروفون:", err));

// دالة إنشاء اتصال WebRTC
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

  // إنشاء offer بعد الانضمام
  peer.createOffer().then(offer => peer.setLocalDescription(offer))
      .then(() => socket.emit("signal", { userId, signal: peer.localDescription }));
}

// دالة عرض الفيديو
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

// نسخ الرابط
function copyLink() {
  navigator.clipboard.writeText(window.location.href);
  alert("تم نسخ الرابط ✅");
}
