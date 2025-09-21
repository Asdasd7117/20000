const SERVER_URL = "https://two0000-lxps.onrender.com"; // رابط السيرفر
const socket = io(SERVER_URL);

// عناصر HTML
const createBtn = document.getElementById("createBtn");
const roomLink = document.getElementById("roomLink");
const copyBtn = document.getElementById("copyBtn");
const localVideo = document.getElementById("localVideo");
const remoteContainer = document.getElementById("remoteContainer");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");
const endCallBtn = document.getElementById("endCall");
const switchCamBtn = document.getElementById("switchCamera");

let localStream;
let currentCamera = "user";
let pcs = {};
const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let roomId, token, selfId;

// ------------------- إنشاء الغرفة -------------------
if (createBtn) {
  createBtn.onclick = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/create-room`);
      const data = await res.json();
      roomId = data.roomId;
      token = data.token;

      roomLink.textContent = data.link;
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(data.link)
          .then(() => alert("تم نسخ الرابط!"))
          .catch(() => alert("حدث خطأ أثناء النسخ"));
      };

      alert("انسخ الرابط وشاركه مع صديقك!");
    } catch (err) {
      alert("حدث خطأ أثناء إنشاء الغرفة");
      console.error(err);
    }
  };
}

// ------------------- بدء الكاميرا -------------------
async function startLocal() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera }, audio: true });
  if (localVideo) localVideo.srcObject = localStream;
}

// ------------------- تبديل الكاميرا -------------------
if (switchCamBtn) {
  switchCamBtn.onclick = async () => {
    currentCamera = currentCamera === "user" ? "environment" : "user";
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    await startLocal();
    Object.values(pcs).forEach(pc => localStream.getTracks().forEach(track => pc.addTrack(track, localStream)));
  };
}

// ------------------- إنشاء PeerConnection -------------------
function createPC(remoteId) {
  if (pcs[remoteId]) return pcs[remoteId];
  const pc = new RTCPeerConnection(ICE_CONFIG);
  pcs[remoteId] = pc;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = e => {
    let vid = document.getElementById("remote_" + remoteId);
    if (!vid) {
      vid = document.createElement("video");
      vid.id = "remote_" + remoteId;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.style.width = "100vw";
      vid.style.height = "100vh";
      vid.style.objectFit = "cover";
      remoteContainer.appendChild(vid);
    }
    vid.srcObject = e.streams[0];
  };

  pc.onicecandidate = ev => {
    if (ev.candidate) socket.emit("candidate", { to: remoteId, candidate: ev.candidate });
  };

  return pc;
}

// ------------------- WebSocket -------------------
socket.on("joined", async ({ selfId: id, others }) => {
  selfId = id;
  // إرسال إشعار للطرف الآخر للانضمام (طلب الموافقة)
  others.forEach(async otherId => {
    const pc = createPC(otherId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: otherId, sdp: offer });
  });
});

socket.on("user-joined", async otherId => createPC(otherId));

socket.on("offer", async ({ from, sdp }) => {
  // نعرض زر الانضمام للطرف الثاني
  const joinBtn = document.createElement("button");
  joinBtn.textContent = "انضم إلى الغرفة";
  joinBtn.style.fontSize = "18px";
  joinBtn.style.padding = "12px 25px";
  joinBtn.style.position = "absolute";
  joinBtn.style.top = "50%";
  joinBtn.style.left = "50%";
  joinBtn.style.transform = "translate(-50%, -50%)";
  joinBtn.style.zIndex = "999";
  document.body.appendChild(joinBtn);

  joinBtn.onclick = async () => {
    joinBtn.remove();
    await startLocal();
    const pc = createPC(from);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { to: from, sdp: answer });
  };
});

socket.on("answer", async ({ from, sdp }) => {
  const pc = pcs[from];
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("candidate", ({ from, candidate }) => {
  const pc = pcs[from];
  if (!pc) return;
  pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
});

socket.on("room-error", msg => alert(msg));

socket.on("user-left", id => {
  const vid = document.getElementById("remote_" + id);
  if (vid) vid.remove();
  delete pcs[id];
});

// ------------------- الدردشة -------------------
if (sendBtn) {
  sendBtn.onclick = () => {
    const text = msgInput.value.trim();
    if (!text) return;
    socket.emit("chat", { roomId, text, name: "أنت" });
    addMessage("أنت: " + text);
    msgInput.value = "";
  };
}

socket.on("chat", ({ from, text, name }) => addMessage(`${name || from}: ${text}`));

function addMessage(msg) {
  const div = document.createElement("div");
  div.textContent = msg;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ------------------- إنهاء المكالمة -------------------
if (endCallBtn) {
  endCallBtn.onclick = () => {
    Object.values(pcs).forEach(pc => pc.close());
    pcs = {};
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    window.location.href = "/";
  };
}

// ------------------- التحقق من الرابط عند فتح room.html -------------------
const params = new URLSearchParams(window.location.search);
if (params.has("roomId") && params.has("t")) {
  roomId = params.get("roomId");
  token = params.get("t");
  // هنا لن نبدأ الفيديو مباشرة، بل ننتظر موافقة المستخدم
  // يظهر زر الانضمام تلقائياً إذا لم يكن هناك peer offer
  const joinBtn = document.createElement("button");
  joinBtn.textContent = "انضم إلى الغرفة";
  joinBtn.style.fontSize = "18px";
  joinBtn.style.padding = "12px 25px";
  joinBtn.style.position = "absolute";
  joinBtn.style.top = "50%";
  joinBtn.style.left = "50%";
  joinBtn.style.transform = "translate(-50%, -50%)";
  joinBtn.style.zIndex = "999";
  document.body.appendChild(joinBtn);

  joinBtn.onclick = async () => {
    joinBtn.remove();
    await joinRoom(roomId, token);
  };
}
