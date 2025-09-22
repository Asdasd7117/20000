const SERVER_URL = window.location.origin; // استخدم نفس السيرفر
const socket = io(SERVER_URL);

// عناصر HTML
const createBtn = document.getElementById("createBtn");
const roomLink = document.getElementById("roomLink");
const copyBtn = document.getElementById("copyBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
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
      if (!res.ok) throw new Error("فشل الاتصال بالخادم");
      const data = await res.json();
      if (!data.roomId || !data.token) throw new Error("بيانات الغرفة غير صحيحة");
      roomId = data.roomId;
      token = data.token;

      const fullLink = `${window.location.origin}/room.html?roomId=${roomId}&t=${token}`; // رابط مباشر
      roomLink.textContent = fullLink;
      copyBtn.style.display = "inline-block"; // اعرض زر النسخ
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(fullLink)
          .then(() => alert("تم نسخ الرابط!"))
          .catch(() => alert("حدث خطأ أثناء النسخ"));
      };

      alert("تم إنشاء الغرفة! انسخ الرابط وشاركه.");
      await joinRoom(roomId, token); // ابدأ الغرفة فورًا
    } catch (err) {
      alert(`حدث خطأ: ${err.message}. تحقق من الخادم أو الاتصال بالإنترنت.`);
      console.error(err);
    }
  };
}

// ------------------- بدء الكاميرا -------------------
async function startLocal() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera }, audio: true });
    if (localVideo) {
      localVideo.srcObject = localStream;
      await localVideo.play().catch(err => console.error("فشل التشغيل التلقائي:", err));
    }
  } catch (err) {
    console.error("فشل الوصول للكاميرا/الميكروفون:", err);
    alert("يرجى السماح بالوصول إلى الكاميرا والميكروفون!");
  }
}

// ------------------- تبديل الكاميرا -------------------
if (switchCamBtn) {
  switchCamBtn.onclick = async () => {
    currentCamera = currentCamera === "user" ? "environment" : "user";
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    await startLocal();
    Object.values(pcs).forEach(pc => {
      localStream.getTracks().forEach(track => {
        if (!pc.getSenders().some(sender => sender.track === track)) {
          pc.addTrack(track, localStream);
        }
      });
    });
  };
}

// ------------------- الانضمام للغرفة -------------------
async function joinRoom(rid, tok) {
  await startLocal();
  roomId = rid;
  token = tok;
  socket.emit("join-room", { roomId, token }, (response) => {
    if (response.error) alert(`خطأ في الانضمام: ${response.error}`);
  });
}

// ------------------- إنشاء PeerConnection -------------------
function createPC(remoteId) {
  if (pcs[remoteId]) return pcs[remoteId];
  const pc = new RTCPeerConnection(ICE_CONFIG);
  pcs[remoteId] = pc;

  if (localStream) {
    localStream.getTracks().forEach(track => {
      if (!pc.getSenders().some(sender => sender.track === track)) {
        pc.addTrack(track, localStream);
      }
    });
  }

  pc.ontrack = e => {
    if (remoteVideo) {
      remoteVideo.srcObject = e.streams[0];
      remoteVideo.play().catch(err => console.error("فشل تشغيل الفيديو البعيد:", err));
    }
  };

  pc.onicecandidate = ev => {
    if (ev.candidate) socket.emit("candidate", { to: remoteId, candidate: ev.candidate });
  };

  return pc;
}

// ------------------- WebSocket -------------------
socket.on("connect", () => console.log("تم الاتصال بالسيرفر"));
socket.on("connect_error", (err) => console.error("فشل الاتصال بالسيرفر:", err));

socket.on("joined", async ({ selfId: id, others }) => {
  selfId = id;
  console.log("انضممت بنجاح، معرفي:", id, "آخرون:", others);
  for (let otherId of others) {
    const pc = createPC(otherId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: otherId, sdp: offer });
  }
});

socket.on("user-joined", async otherId => {
  console.log("مستخدم جديد انضم:", otherId);
  createPC(otherId);
});

socket.on("offer", async ({ from, sdp }) => {
  const pc = createPC(from);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));

  const agree = confirm("هل تريد قبول المكالمة من هذا الشخص؟");
  if (!agree) {
    alert("رفضت المكالمة.");
    return;
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, sdp: answer });
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

socket.on("room-error", msg => alert(`خطأ في الغرفة: ${msg}`));

socket.on("user-left", id => {
  if (remoteVideo) remoteVideo.srcObject = null;
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
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localVideo.srcObject = null;
    }
    if (remoteVideo) remoteVideo.srcObject = null;
    window.location.href = "/";
  };
}

// ------------------- التحقق من الرابط عند فتح room.html -------------------
const params = new URLSearchParams(window.location.search);
if (params.has("roomId") && params.has("t")) {
  const rid = params.get("roomId");
  const tok = params.get("t");

  const agree = confirm("هل تريد الانضمام إلى هذه الغرفة؟");
  if (agree) {
    joinRoom(rid, tok);
  } else {
    alert("رفضت الانضمام للغرفة.");
  }
}
