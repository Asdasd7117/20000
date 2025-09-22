const socket = io();
const videos = document.getElementById('videos');
const myVideo = document.createElement('video');
myVideo.muted = true;
let myStream;
const peers = {};

// الحصول على الفيديو والصوت
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    myStream = stream;
    myVideo.srcObject = stream;
    myVideo.play();
    videos.appendChild(myVideo);

    const roomId = prompt("ادخل اسم الغرفة:");
    socket.emit('join-room', roomId);

    // عند انضمام مستخدم جديد
    socket.on('user-connected', userId => {
      connectToNewUser(userId, stream);
    });

    // استقبال الإشارات من peers
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

    // عند خروج مستخدم
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

    // مشاركة الشاشة
    const shareScreenBtn = document.getElementById('shareScreen');
    shareScreenBtn.onclick = async () => {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

        // تبديل مسار الفيديو لكل peers
        for (let id in peers) {
          const sender = peers[id].getSenders().find(s => s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenStream.getVideoTracks()[0]);
        }

        // عرض الشاشة محليًا
        const screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        screenVideo.autoplay = true;
        screenVideo.playsInline = true;
        videos.appendChild(screenVideo);

        // إعادة الفيديو الأصلي عند انتهاء مشاركة الشاشة
        screenStream.getVideoTracks()[0].onended = () => {
          for (let id in peers) {
            const sender = peers[id].getSenders().find(s => s.track.kind === 'video');
            if (sender) sender.replaceTrack(myStream.getVideoTracks()[0]);
          }
          screenVideo.remove();
        };

      } catch (err) {
        console.error("خطأ في مشاركة الشاشة:", err);
        alert("لم يتمكن التطبيق من مشاركة الشاشة. تأكد من السماح بالوصول.");
      }
    }

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
