"use strict";

let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let isInitiator = false;
let isChannelReady = false;
let isStarted = false;
let localStream;
let remoteStream;
let pc;

let pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun1.l.google.com:19302'
  }]
}

let room = 'foo';

let socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join Room', room);
}

socket.on('owned', (room, id) => {
  console.log(`I am a creator (${id}) on this ${room}`);
  isInitiator = true;
})

socket.on('full', room => {
  console.log('Room ' + room + 'is full');
});

socket.on('notify', room => {
  console.log('Another peer made a request to join room' + room);
  console.log('This peer is the initiator of room' + room + '!');
  isChannelReady = true;
})

socket.on('joined', room => {
  console.log('joined : ' + room);
  isChannelReady = true;
})
socket.on('log', msg => {
  console.log(msg);
});

socket.on('message', (message) => {
  console.log('I have just received ', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });

    pc.addIceCandidate(candidate);
  }
})
function sendMessage(message) {
  console.log('A new message is being sent: ', message);
  socket.emit('message', message);
}

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: false,
  })
  .then(gotStream)
  .catch((error) => console.error(error));

function gotStream(stream) {
  console.log("Adding local stream");
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage("got user media");
  if (isInitiator) {
    maybeStart();
  }
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    console.log("Created RTCPeerConnection");
  } catch (e) {
    alert("connot create RTCPeerConnection object");
    return;
  }
}

function handleIceCandidate(event) {
  console.log("iceCandidateEvent", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("end of candidates");
  }
}

function handleCreateOfferError(event) {
  console.log("createOffer() error: ", event);
}

function handleRemoteStreamAdded(event) {
  console.log("remote stream added", event);
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function maybeStart() {
  console.log(">>MaybeStart() : ", isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== "undefined" && isChannelReady) {
    console.log(">>>>> creating peer connection");
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log("isInitiator : ", isInitiator);
    if (isInitiator) {
      doCall();
    }
  } else {
    console.error('maybeStart not Started!');
  }
}

function doCall() {
  console.log("Sending offer to peer");
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log("Sending answer to peer");
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  console.error("Falied to create session Description", error);
}
