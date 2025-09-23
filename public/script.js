const socket = io();
const videoGrid = document.getElementById("videos");
const peers = {};
let localStream;

// استخراج roomId من الرابط
let roomId = window.location.pathname.split("/")[2];
if (!roomId) {
  roomId = crypto.randomUUID();
  window.history.replaceState(null, "Room", `/room/${roomId}`);
}
console.log("🔑 Room ID:", roomId);

document.getElementById("roomLink").value = window.location.href;

// الحصول على الميديا المحلية
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    console.log("🎥 تم الحصول على MediaStream المحلي");
    localStream = stream;
    addVideoStream(stream, "أنا");

    socket.emit("join-room", roomId);
    console.log("📨 تم إرسال join-room:", roomId);

    socket.on("user-connected", userId => {
      console.log("👤 مستخدم جديد متصل:", userId);
      const peer = createPeer(userId, stream, true);
      peers[userId] = peer;
    });

    socket.on("signal", data => {
      console.log("📥 استلام signal من:", data.userId, data.signal);
      let peer = peers[data.userId];
      if (!peer) {
        console.log("⚙️ إنشاء Peer جديد للطرف المستقبل");
        peer = createPeer(data.userId, stream, false);
        peers[data.userId] = peer;
      }
      try {
        peer.signal(data.signal);
      } catch (err) {
        console.error("❌ خطأ أثناء peer.signal:", err);
      }
    });

    socket.on("user-disconnected", userId => {
      console.log("🚪 مستخدم غادر:", userId);
      if (peers[userId]) {
        peers[userId].destroy();
        delete peers[userId];
      }
    });
  })
  .catch(err => console.error("❌ خطأ في الحصول على MediaStream:", err));

// دالة إنشاء Peer باستخدام SimplePeer
function createPeer(userId, stream, initiator) {
  console.log("⚙️ إنشاء Peer:", userId, "initiator=", initiator);
  const peer = new SimplePeer({ initiator, trickle: false, stream });

  peer.on("signal", signal => {
    console.log("📤 إرسال signal إلى:", userId, signal);
    socket.emit("signal", { userId, signal });
  });

  peer.on("stream", remoteStream => {
    console.log("✅ تم استقبال Stream من:", userId);
    addVideoStream(remoteStream, `👤 ${userId}`);
  });

  peer.on("error", err => console.error("⚠️ Peer error:", err));

  return peer;
}

// دالة عرض الفيديو
function addVideoStream(stream, label) {
  console.log("🎬 عرض فيديو:", label);
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;

  const container = document.createElement("div");
  container.appendChild(video);
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
