const socket = io();

const createBtn = document.getElementById("createBtn");
const linkDiv = document.getElementById("linkDiv");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("endCall");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");

let localStream, pc, roomId, token;

// ---------------------- إنشاء غرفة ----------------------
if (createBtn) {
  createBtn.onclick = async () => {
    const res = await fetch("/create-room");
    const data = await res.json();
    roomId = data.roomId;
    token = data.token;
    linkDiv.innerHTML = `<a href="${data.link}" target="_blank">${data.link}</a>`;
    alert("انسخ الرابط وشاركه مع صديقك!");
  };
}

// ---------------------- بدء الكاميرا ----------------------
async function startLocal() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (localVideo) localVideo.srcObject = localStream;
}

// ---------------------- الانضمام للغرفة ----------------------
async function joinRoom(rid, tok) {
  roomId = rid;
  token = tok;
  await startLocal();
  pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = e => { remoteVideo.srcObject = e.streams[0]; };

  pc.onicecandidate = ev => {
    if (ev.candidate) socket.emit("candidate", { roomId, candidate: ev.candidate });
  };

  socket.emit("join-room", { roomId, token });
}

// ---------------------- إنهاء المكالمة ----------------------
if (endCallBtn) {
  endCallBtn.onclick = () => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (pc) pc.close();
    socket.emit("leave-room", { roomId });
    window.location.href = "/";
  };
}

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

socket.on("chat", ({ name, text }) => { addMessage(`${name}: ${text}`); });
function addMessage(msg) {
  const div = document.createElement("div");
  div.textContent = msg;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ---------------------- قراءة الرابط ----------------------
const params = new URLSearchParams(window.location.search);
if (params.has("roomId") && params.has("t")) {
  joinRoom(params.get("roomId"), params.get("t"));
}
