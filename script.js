const socket = io();

const createBtn = document.getElementById("createBtn");
const linkDiv = document.getElementById("linkDiv");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("endCall");
const switchBtn = document.getElementById("switchCamera"); // زر التبديل بين الكاميرات
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");

let localStream, pc, roomId, token;
let usingFrontCamera = true;

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
  try {
    const constraints = {
      video: { facingMode: usingFrontCamera ? "user" : "environment" },
      audio: true
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (localVideo) localVideo.srcObject = localStream;
  } catch (err) {
    alert("لا يمكن الوصول إلى الكاميرا أو الميكروفون. تأكد من إعطاء الإذن.");
    throw err;
  }
}

// ---------------------- تبديل الكاميرا ----------------------
if (switchBtn) {
  switchBtn.onclick = async () => {
    usingFrontCamera = !usingFrontCamera;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    await startLocal();
    if (pc) {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = pc.getSenders().find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    }
  };
}

// ---------------------- الانضمام للغرفة ----------------------
async function joinRoom(rid, tok) {
  const allow = confirm("الموافقة على الانضمام للغرفة؟"); // طلب موافقة المستخدم
  if (!allow) return;

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

// ---------------------- قراءة الرابط والانضمام ----------------------
const params = new URLSearchParams(window.location.search);
if (params.has("roomId") && params.has("t")) {
  joinRoom(params.get("roomId"), params.get("t"));
}
