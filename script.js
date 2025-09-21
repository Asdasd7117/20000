const socket = io();

// العناصر
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("endCall");
const switchBtn = document.getElementById("switchCamera");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");
const joinPopup = document.getElementById("joinRequest");
const approveBtn = document.getElementById("approveJoin");
const denyBtn = document.getElementById("denyJoin");

let localStream, pc;
let useFrontCamera = true;
let roomId, token;
let pendingPeer = null; // لتخزين من يطلب الانضمام

// ------------------ بدء الكاميرا ------------------
async function startLocal() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: useFrontCamera ? "user" : "environment" },
    audio: true
  });
  localVideo.srcObject = localStream;
}

// ------------------ تبديل الكاميرا ------------------
if (switchBtn) switchBtn.onclick = async () => {
  useFrontCamera = !useFrontCamera;
  if (!localStream) return;
  localStream.getTracks().forEach(t => t.stop());
  await startLocal();
  const videoTrack = localStream.getVideoTracks()[0];
  const sender = pc.getSenders().find(s => s.track.kind === "video");
  if (sender) sender.replaceTrack(videoTrack);
};

// ------------------ إنهاء المكالمة ------------------
if (endCallBtn) endCallBtn.onclick = () => {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  if (pc) pc.close();
  socket.emit("leave-room", { roomId });
  window.location.href = "/";
};

// ------------------ الدردشة ------------------
if (sendBtn) sendBtn.onclick = () => {
  const text = msgInput.value.trim();
  if (!text || !roomId) return;
  socket.emit("chat", { roomId, text, name: "أنت" });
  addMessage("أنت: " + text);
  msgInput.value = "";
};
function addMessage(msg) {
  const div = document.createElement("div");
  div.textContent = msg;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
socket.on("chat", ({ name, text }) => addMessage(`${name}: ${text}`));

// ------------------ WebRTC ------------------
function createPC(remoteId) {
  pc = new RTCPeerConnection({ iceServers:[{ urls: "stun:stun.l.google.com:19302" }] });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = e => { remoteVideo.srcObject = e.streams[0]; };
  pc.onicecandidate = ev => {
    if (ev.candidate) socket.emit("candidate", { roomId, candidate: ev.candidate, to: remoteId });
  };
  return pc;
}

// ------------------ قراءة الرابط ------------------
const params = new URLSearchParams(window.location.search);
if (params.has("roomId") && params.has("t")) {
  roomId = params.get("roomId");
  token = params.get("t");
  // اطلب الانضمام
  socket.emit("request-join", { roomId, token });
}

// ------------------ طلب الانضمام ------------------
socket.on("join-request", (peerId) => {
  pendingPeer = peerId;
  joinPopup.style.display = "block";
});

approveBtn.onclick = async () => {
  joinPopup.style.display = "none";
  if (!pendingPeer) return;
  await startLocal();
  pc = createPC(pendingPeer);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("approve-join", { to: pendingPeer, sdp: offer, roomId });
  pendingPeer = null;
};

denyBtn.onclick = () => {
  if (pendingPeer) socket.emit("deny-join", { to: pendingPeer, roomId });
  joinPopup.style.display = "none";
  pendingPeer = null;
};

// ------------------ استقبال الإشارات ------------------
socket.on("offer", async ({ from, sdp }) => {
  await startLocal();
  pc = createPC(from);
  await pc.setRemoteDescription(sdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, sdp: answer });
});
socket.on("answer", async ({ from, sdp }) => {
  await pc.setRemoteDescription(sdp);
});
socket.on("candidate", ({ from, candidate }) => {
  if (pc) pc.addIceCandidate(candidate).catch(console.error);
});
socket.on("user-left", () => { remoteVideo.srcObject = null; });
