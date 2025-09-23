<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<title>غرفة الفيديو</title>
<style>
body { background:#111; color:#fff; text-align:center; font-family:Arial; }
#videos { display:flex; flex-wrap:wrap; justify-content:center; }
video { width:300px; margin:5px; border-radius:10px; border:2px solid #0f0; }
</style>
</head>
<body>
<h2>غرفة الفيديو</h2>
<div id="videos"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const roomId = window.location.pathname.split("/").pop();
const videosDiv = document.getElementById("videos");
const peers = {};
let localStream;

// STUN server
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// إضافة فيديو للشاشة
function addVideo(stream, id) {
  let video = document.getElementById(id);
  if(!video){
    video = document.createElement("video");
    video.id = id;
    video.autoplay = true;
    video.playsInline = true;
    videosDiv.appendChild(video);
  }
  video.srcObject = stream;
}

// الحصول على كاميرا وصوت
navigator.mediaDevices.getUserMedia({video:true,audio:true})
.then(stream=>{
  localStream = stream;
  addVideo(stream,"me");
  socket.emit("join-room",roomId);
})
.catch(err=>console.error("خطأ بالكاميرا/ميكروفون:",err));

// إنشاء Peer
function createPeer(targetId, initiator){
  const pc = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));

  pc.ontrack = event => addVideo(event.streams[0], targetId);

  pc.onicecandidate = event => {
    if(event.candidate)
      socket.emit("signal",{to:targetId,signal:{candidate:event.candidate}});
  };

  return pc;
}

// استقبال المستخدمين الجدد
socket.on("user-joined", userId=>{
  const pc = createPeer(userId,true);
  peers[userId]=pc;
  pc.createOffer().then(offer=>{
    pc.setLocalDescription(offer);
    socket.emit("signal",{to:userId,signal:{sdp:offer}});
  });
});

// استقبال إشارات
socket.on("signal",async data=>{
  let pc = peers[data.from];
  if(!pc){ pc=createPeer(data.from,false); peers[data.from]=pc; }

  if(data.signal.sdp){
    await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
    if(data.signal.sdp.type==="offer"){
      const answer=await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal",{to:data.from,signal:{sdp:answer}});
    }
  } else if(data.signal.candidate){
    try{ await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate)); }
    catch(err){ console.error(err); }
  }
});

// إزالة المستخدم عند الخروج
socket.on("user-left",userId=>{
  if(peers[userId]){ peers[userId].close(); delete peers[userId]; }
  const video=document.getElementById(userId);
  if(video) video.remove();
});
</script>
</body>
</html>
