// رابط السيرفر على Render
const SERVER_URL = "https://two0000-lxps.onrender.com/"; 
const socket = io(SERVER_URL);

// عناصر HTML
const createBtn = document.getElementById("createBtn");
const linkDiv = document.getElementById("linkDiv");
const roomLink = document.getElementById("roomLink");
const copyBtn = document.getElementById("copyBtn");
const localVideo = document.getElementById("localVideo");
const remoteContainer = document.getElementById("remoteContainer");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");

let localStream;
const pcs = {}; // تخزين الـ PeerConnections
const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let roomId, token, selfId;

// ---------------------- إنشاء الغرفة ----------------------
if (createBtn) {
  createBtn.onclick = async () => {
    const res = await fetch(SERVER_URL + "/create-room");
    const data = await res.json();
    roomId = data.roomId;
    token = data.token;

    // عرض الرابط في span
    roomLink.textContent = data.link;

    // تنشيط زر النسخ
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(data.link)
        .then(() => alert("تم نسخ الرابط!"))
        .catch(err => alert("حدث خطأ أثناء النسخ"));
    };

    alert("انسخ الرابط وشاركه مع صديقك!");
  };
}

// ---------------------- بدء الكاميرا ----------------------
async function startLocal() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (localVideo) localVideo.srcObject = localStream;
}

// ---------------------- الانضمام للغرفة ----------------------
async function joinRoom(roomIdParam, tokenParam) {
  await startLocal();
  roomId = roomIdParam;
  token = tokenParam;
  socket.emit("join-room", { roomId, token });
}

// ---------------------- إنشاء PeerConnection ----------------------
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
      remoteContainer.appendChild(vid);
    }
    vid.srcObject = e.streams[0];
  };

  pc.onicecandidate = ev => {
    if (ev.candidate) socket.emit("candidate", { to: remoteId, candidate: ev.candidate });
  };

  return pc;
}

// ---------------------- استقبال إشارات من السيرفر ----------------------
socket.on("joined", async ({ selfId: id, others }) => {
  selfId = id;
  for (let otherId of others) {
    const pc = createPC(otherId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: otherId, sdp: offer });
  }
});

socket.on("user-joined", async otherId => {
  createPC(otherId);
});

socket.on("offer", async ({ from, sdp }) => {
  const pc = createPC(from);
  await pc.setRemoteDescription(sdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, sdp: answer });
});

socket.on("answer", async ({ from, sdp }) => {
  const pc = pcs[from];
  if (!pc) return;
  await pc.setRemoteDescription(sdp);
});

socket.on("candidate", ({ from, candidate }) => {
  const pc = pcs[from];
  if (!pc) return;
  pc.addIceCandidate(candidate).catch(console.error);
});

socket.on("room-error", msg => alert(msg));

socket.on("user-left", id => {
  const vid = document.getElementById("remote_" + id);
  if (vid) vid.remove();
  delete pcs[id];
});

// ---------------------- الدردشة ----------------------
if (sendBtn) {
  sendBtn.onclick = () => {
    const text = msgInput.value.trim();
    if (!text) return;
    socket.emit("chat", { roomId, text, name: "أنت" });
    addMessage("أنت: " + text);
    msgInput.value = "";
  };
}

socket.on("chat", ({ from, text, name }) => {
  addMessage(`${name || from}: ${text}`);
});

function addMessage(msg) {
  const div = document.createElement("div");
  div.textContent = msg;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ---------------------- إذا كان الرابط فيه room و token ----------------------
const params = new URLSearchParams(window.location.search);
if (params.has("t") && window.location.pathname.includes("/room.html")) {
  const rid = params.get("roomId");
  const tok = params.get("t");
  joinRoom(rid, tok);
}
