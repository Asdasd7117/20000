const socket = io();
const videoGrid = document.getElementById("videos");
const peers = {};
let myStream;

// استخراج معرف الغرفة من الرابط
let roomId = window.location.pathname.split("/")[2];
if (!roomId) {
  roomId = crypto.randomUUID();
  window.history.replaceState(null, "Room", `/room/${roomId}`);
}
document.getElementById("roomLink").value = window.location.href;

// الحصول على الفيديو والصوت
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    myStream = stream;
    addVideoStream(stream, "أنا");

    // الانضمام للغرفة بعد جاهزية stream
    socket.emit("join-room", roomId);

    // استقبال مستخدمين موجودين مسبقًا
    socket.on("all-users", users => {
      users.forEach(userId => {
        const peer = createPeer(userId, socket.id, stream);
        peers[userId] = peer;
      });
    });

    // استقبال signal من الآخرين
    socket.on("signal", data => {
      const peer = peers[data.from];
      if (peer) {
        peer.signal(data.signal);
      } else {
        // إنشاء peer جديد إذا لم يكن موجود
        const newPeer = addPeer(data.signal, data.from, stream);
        peers[data.from] = newPeer;
      }
    });

    socket.on("user-disconnected", userId => {
      if (peers[userId]) {
        peers[userId].destroy();
        delete peers[userId];
      }
    });
  })
  .catch(err => console.error("خطأ في الكاميرا أو الميكروفون:", err));

// دوال WebRTC باستخدام Simple-Peer (أسهل وأضمن)
function createPeer(userToSignal, callerId, stream) {
  const peer = new SimplePeer({ initiator: true, trickle: false, stream });
  peer.on("signal", signal => {
    socket.emit("signal", { userId: userToSignal, signal, from: callerId });
  });
  peer.on("stream", remoteStream => addVideoStream(remoteStream, `👤 ${userToSignal}`));
  return peer;
}

function addPeer(incomingSignal, callerId, stream) {
  const peer = new SimplePeer({ initiator: false, trickle: false, stream });
  peer.on("signal", signal => {
    socket.emit("signal", { userId: callerId, signal, from: socket.id });
  });
  peer.on("stream", remoteStream => addVideoStream(remoteStream, `👤 ${callerId}`));
  peer.signal(incomingSignal);
  return peer;
}

function addVideoStream(stream, label) {
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

function copyLink() {
  navigator.clipboard.writeText(window.location.href);
  alert("تم نسخ الرابط ✅");
}
