const peerConnections = new Set();
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let dataChannel;
let peerConnection;

export async function createNewRoom() {
  peerConnection = new RTCPeerConnection(configuration);

  dataChannel = peerConnection.createDataChannel("chat");
  setupDataChannel(dataChannel);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  peerConnections.add(peerConnection);

  const newOffer = await new Promise((resolve, reject) => {
    peerConnection.onicecandidate = (event) => {
      if (event.candidate === null) {
        resolve(offer);
      }
    };
  });
  console.log(
    "Room created successfully. Connection string for the remote peer:\n\n%s\n",
    JSON.stringify(peerConnection.localDescription),
  );
}

// Handle incoming connections
async function joinRoom(offerStr) {
  console.log("Joining room...");
  const offer = JSON.parse(offerStr);
  peerConnection = new RTCPeerConnection(configuration);

  const { resolve, promise } = Promise.withResolvers();

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
    waitForDataChannelOpen().then(resolve);
  };

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  peerConnections.add(peerConnection);

  console.log(
    "Connection string for the room creator:\n\n%s\n",
    JSON.stringify(peerConnection.localDescription),
  );

  return promise;
}

async function acceptConnection(offerStr) {
  console.log("Accepting remote connection...");
  const offer = JSON.parse(offerStr);
  peerConnection.setRemoteDescription(offer);
  await waitForDataChannelOpen();
}

function setupDataChannel() {
  dataChannel.onmessage = (event) => {
    console.log("<", event.data);
  };
}

function waitForDataChannelOpen() {
  return new Promise((resolve) => dataChannel.addEventListener("open", resolve));
}

export function connect(offerStr) {
  return peerConnection ? acceptConnection(offerStr) : joinRoom(offerStr);
}

// Function to send messages to all peers
export function sendMessage(message) {
  if (dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(message);
  } else {
    console.log(
      "Data channel not ready. State:",
      dataChannel?.readyState ?? "<not initialized yet>",
    );
  }
}
