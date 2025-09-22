const socket = io();
const videos = document.getElementById('videos');
const myVideo = document.createElement('video');
myVideo.muted = true;
let myStream;
const peers = {};

// الحصول على معرف الغرفة من الرابط
let roomId = window.location.pathname.split('/')[2];

// الانضمام للغرفة
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    myStream = stream;
    myVideo.srcObject = stream;
    myVideo.play();
    videos.appendChild(myVideo);

    socket.emit('join-room', roomId);

    // عرض رابط الغرفة
    document.getElementById('roomLink').value = window.location.href;

    // التعامل مع مستخدمين جدد
    socket.on('user-connected', userId => {
      connectToNewUser(userId, stream);
    });

    socket.on('signal', async data => {
      if (!peers[data.from]) return;
      if (data.sdp) {
        await peers[data.from].setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await peers[data.from].createAnswer();
          await peers[data.from].setLocalDescription(answer);
          socket.emit('signal', { to: data.from, sdp: peers[data.from].localDescription });
        }
      } else if (data.candidate) {
        await peers[data.from].addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on('user-disconnected', userId => {
      if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
      }
    });

    // الدردشة
    const chatInput = document.getElementById('chatInput');
    const sendChat = document.getElementById('sendChat');
    const chatBox = document.getElementById('chatBox');

    sendChat.onclick = () => {
      if (chatInput.value.trim() === "") return;
      const msg = chatInput.value;
      socket.emit('chat-message', msg);
      chatBox.innerHTML += `<p><b>أنا:</b> ${msg}</p>`;
      chatInput.value = "";
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    socket.on('chat-message', data => {
      chatBox.innerHTML += `<p><b>${data.user}:</b> ${data.msg}</p>`;
      chatBox.scrollTop = chatBox.scrollHeight;
    });

  })
  .catch(err => console.error("خطأ في الوصول للكاميرا أو الميكروفون:", err));

// دالة إنشاء اتصال مع مستخدم جديد
function connectToNewUser(userId, stream) {
  const peer = new RTCPeerConnection();
  peers[userId] = peer;

  stream.getTracks().forEach(track => peer.addTrack(track, stream));

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', { to: userId, candidate: e.candidate });
    }
  };

  peer.ontrack = e => {
    const video = document.createElement('video');
    video.srcObject = e.streams[0];
    video.autoplay = true;
    video.playsInline = true;
    videos.appendChild(video);
  };

  peer.createOffer().then(offer => peer.setLocalDescription(offer))
    .then(() => {
      socket.emit('signal', { to: userId, sdp: peer.localDescription });
    });
}
