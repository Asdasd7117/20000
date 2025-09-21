const socket = io();

// -------------------- index.html --------------------
const createBtn = document.getElementById("createBtn");
const linkDiv = document.getElementById("linkDiv");

if (createBtn) {
  createBtn.addEventListener("click", async () => {
    const res = await fetch("/create-room");
    const data = await res.json();
    linkDiv.innerHTML = `
      <p>رابط الغرفة:</p>
      <input type="text" id="roomLink" value="${data.link}" readonly>
      <button id="copyBtn">نسخ</button>
    `;
    document.getElementById("copyBtn").addEventListener("click", () => {
      const input = document.getElementById("roomLink");
      input.select();
      document.execCommand("copy");
      alert("تم نسخ الرابط!");
    });
  });
}

// -------------------- room.html --------------------
const url = new URL(window.location.href);
const roomId = url.searchParams.get("roomId");
const token = url.searchParams.get("t");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const leaveBtn = document.getElementById("leaveBtn");
const toggleCameraBtn = document.getElementById("toggleCamera");

const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

let localStream;
let pc;
let currentCamera = "user"; // user = امامية, environment = خلفية

if (roomId && token) {
  startRoom();
}

async function startRoom() {
  socket.emit("join-room", { roomId, token });

  socket.on("room-error", msg => alert(msg));

  socket.on("user-joined", async (id) => {
    console.log("مستخدم جديد:", id);
    await createPeerConnection(id, true);
  });

  socket.on("offer", async ({ from, sdp }) => {
    await createPeerConnection(from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { to: from, sdp: answer });
  });

  socket.on("answer", async ({ from, sdp }) => {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  });

  socket.on("candidate", ({ from, candidate }) => {
    if (candidate && pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  socket.on("chat", data => {
    const msg = document.createElement("p");
    msg.textContent = data;
    messagesDiv.appendChild(msg);
  });

  socket.on("user-left", id => {
    console.log("المستخدم خرج:", id);
    if (remoteVideo) remoteVideo.srcObject = null;
  });

  // طلب إذن الكاميرا + مايك
  localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera }, audio: true });
  localVideo.srcObject = localStream;
}

async function createPeerConnection(peerId, isCaller) {
  pc = new RTCPeerConnection();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", { to: peerId, candidate: event.candidate });
    }
  };

  if (isCaller) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: peerId, sdp: offer });
  }
}

// زر إرسال رسالة
if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    const msg = chatInput.value;
    if (msg.trim() !== "") {
      socket.emit("chat", msg);
      chatInput.value = "";
    }
  });
}

// زر الخروج
if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    socket.emit("leave-room");
    if (pc) pc.close();
    window.location.href = "/";
  });
}

// تبديل الكاميرا
if (toggleCameraBtn) {
  toggleCameraBtn.addEventListener("click", async () => {
    currentCamera = currentCamera === "user" ? "environment" : "user";
    if (localStream) {
      const tracks = localStream.getTracks();
      tracks.forEach(track => track.stop());
    }
    localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera }, audio: true });
    localVideo.srcObject = localStream;

    if (pc) {
      const senders = pc.getSenders();
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = senders.find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    }
  });
}
