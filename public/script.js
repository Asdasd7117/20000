const socket = io();
const videoGrid = document.getElementById("video-grid");

// استخراج roomId من الرابط
const pathParts = window.location.pathname.split("/");
const roomId = pathParts[2];

document.getElementById("roomLink").value = window.location.href;

function copyLink() {
  navigator.clipboard.writeText(window.location.href);
  alert("تم نسخ الرابط ✅");
}

const myVideo = document.createElement("video");
myVideo.muted = true;

const peer = new Peer(undefined, {
  host: "peerjs.com",
  port: 443,
  secure: true
});

let myStream;
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myStream = stream;
  addVideoStream(myVideo, stream);

  peer.on("call", call => {
    call.answer(stream);
    const video = document.createElement("video");
    call.on("stream", userVideoStream => {
      addVideoStream(video, userVideoStream);
    });
  });

  socket.on("user-connected", userId => {
    connectToNewUser(userId, stream);
  });
});

peer.on("open", id => {
  socket.emit("join-room", roomId, id);
});

function connectToNewUser(userId, stream) {
  const call = peer.call(userId, stream);
  const video = document.createElement("video");
  call.on("stream", userVideoStream => {
    addVideoStream(video, userVideoStream);
  });
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}
