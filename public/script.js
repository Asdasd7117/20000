const socket = io();
const videoGrid = document.getElementById("videos");
const peers = {};

// استخدام معرف الغرفة من الرابط
let pathParts = window.location.pathname.split("/");
let roomId = pathParts[2];

if (!roomId) {
  // إنشاء غرفة جديدة فقط إذا الرابط لا يحتوي معرف
  roomId = crypto.randomUUID();
  window.history.replaceState(null, "Room", `/room/${roomId}`);
}

// عرض رابط الغرفة للنسخ
document.getElementById("roomLink").value = window.location.href;

// إعداد الفيديو المحلي
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    addVideoStream(stream, "أنا");

    socket.emit("join-room", roomId);

    // عندما ينضم مستخدم جديد
    socket.on("user-connected", userId => {
      connectToNewUser(userId, stream);
    });

    // استقبال الإشارات من الآخرين
    socket.on("signal", async data => {
      let peer = peers[data.userId];
      if (!peer) {
        peer = createPeer(data.userId, stream, false);
        peers[data.userId] = peer;
      }

      if (data.signal.type === "offer") {
        await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("signal", { roomId, signal: peer.localDescription });
      } else if (data.signal.type === "answer") {
        await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
      } else if (data.signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(data.signal));
      }
    });

    // عند خروج مستخدم
    socket.on("user-disconnected", userId => {
      if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
      }
    });
  })
  .catch(err => console.error("خطأ في الوصول للكاميرا أو الميكروفون:", err));

// إنشاء Peer جديد
function connectToNewUser(userId, stream) {
  const peer = createPeer(userId, stream, true);
  peers[userId] = peer;
}

// دالة إنشاء Peer
function createPeer(userId, stream, initiator) {
  const peer = new RTCPeerConnection();

  // إضافة المسارات
  stream.getTracks().forEach(track => peer.addTrack(track, stream));

  // استقبال فيديو من الآخرين
  peer.ontrack = e => addVideoStream(e.streams[0], `👤 ${userId}`);

  // إرسال ICE candidates
  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { roomId, signal: e.candidate });
    }
  };

  // إذا initiator، إنشاء عرض
  if (initiator) {
    peer.createOffer().then(offer => peer.setLocalDescription(offer))
        .then(() => socket.emit("signal", { roomId, signal: peer.localDescription }));
  }

  return peer;
}

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

// نسخ رابط الغرفة
function copyLink() {
  navigator.clipboard.writeText(window.location.href);
  alert("تم نسخ الرابط ✅");
}
