const socket = io();

// استخراج roomId من الرابط
const pathParts = window.location.pathname.split('/');
const roomId = pathParts[pathParts.length - 1];

// إعداد WebRTC
const peers = {};
const localVideo = document.createElement('video');
localVideo.muted = true;
document.getElementById('videos').appendChild(localVideo);

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;
    localVideo.play();

    // الانضمام للغرفة بعد الحصول على الكاميرا
    socket.emit('join-room', roomId);

    socket.on('user-connected', userId => {
      createPeerConnection(userId, stream, true);
    });

    socket.on('signal', async (data) => {
      if (data.from === socket.id) return;

      if (!peers[data.from]) {
        createPeerConnection(data.from, stream, false);
      }

      const pc = peers[data.from];

      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: data.from, sdp: pc.localDescription });
        }
      }

      if (data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('خطأ في ICE:', e);
        }
      }
    });

    socket.on('user-disconnected', userId => {
      if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
        const video = document.getElementById(userId);
        if (video) video.remove();
      }
    });
  })
  .catch(err => {
    alert('لا يمكن الوصول إلى الكاميرا/الميكروفون: ' + err.message);
  });

// إنشاء اتصال WebRTC
function createPeerConnection(userId, stream, initiator) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // إرسال تدفقات الفيديو
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // استقبال الفيديو من الطرف الآخر
  pc.ontrack = event => {
    const remoteVideo = document.createElement('video');
    remoteVideo.id = userId;
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    document.getElementById('videos').appendChild(remoteVideo);
  };

  // تبادل مرشحي ICE
  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('signal', { to: userId, candidate: event.candidate });
    }
  };

  peers[userId] = pc;

  if (initiator) {
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: userId, sdp: pc.localDescription });
    };
  }
}

// 📝 الدردشة النصية
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChat');
const chatBox = document.getElementById('chatBox');

sendChatBtn.addEventListener('click', () => {
  const msg = chatInput.value;
  if (msg.trim() !== '') {
    appendMessage('أنا', msg);
    socket.emit('chat-message', msg);
    chatInput.value = '';
  }
});

socket.on('chat-message', data => {
  appendMessage(data.user, data.msg);
});

function appendMessage(user, msg) {
  const p = document.createElement('p');
  p.textContent = user + ': ' + msg;
  chatBox.appendChild(p);
}
