import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from "socket.io-client";
import { Box, Grid, Snackbar, Alert, Typography, TextField, Button, List, ListItem, ListItemText } from "@mui/material";
import Lobby from './Lobby';
import VideoPlayer from './VideoPlayer';

const App = () => {
  const socket = useMemo(() => io("http://localhost:4000/"), []);
  const [myStream, setMyStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [user, setUser] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '' });
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const peerConnections = useRef({});

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMyStream(stream);
      } catch (err) {
        console.error("Error accessing media devices.", err);
      }
    };
    initMedia();
  }, []);

  
  useEffect(() => {
    if (!socket || !myStream || !user) return;

    const createPeerConnection = (socketID, username) => {
      if (peerConnections.current[socketID]) {
        return;
      }
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidates", { candidate: event.candidate, to: socketID });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({ ...prev, [socketID]: { stream: event.streams[0], username } }));
      };

      myStream.getTracks().forEach(track => pc.addTrack(track, myStream));
      peerConnections.current[socketID] = pc;
    };

    const callUser = async (socketID, username) => {
      createPeerConnection(socketID, username);
      const pc = peerConnections.current[socketID];
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { offer, to: socketID });
    };

    const handleExistingUsers = (users) => {
      users.forEach(u => callUser(u.id, u.username));
    };
    
    const handleUserJoined = ({ id, username }) => {
        setNotification({ open: true, message: `${username} joined the room.` });
    };

    const handleWebrtcOffer = async ({ offer, from }) => {
      // Find username of the offerer
      // This is a simplification; a more robust solution would pass the username with the offer
      createPeerConnection(from, 'A new user'); // Placeholder username
      const pc = peerConnections.current[from];
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { answer, to: from });
    };

    const handleWebrtcAnswer = async ({ answer, from }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleWebrtcIceCandidates = async ({ candidate, from }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleUserLeft = (socketID) => {
      if (peerConnections.current[socketID]) {
        peerConnections.current[socketID].close();
        delete peerConnections.current[socketID];
      }
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        // Get username before deleting for notification
        const username = newStreams[socketID]?.username || 'A user';
        delete newStreams[socketID];
        setNotification({ open: true, message: `${username} left the room.` });
        return newStreams;
      });
    };

    const handleReceiveMessage = ({ message, username }) => {
      setMessages(prev => [...prev, { username, message }]);
      setNotification({ open: true, message: `${username}: ${message}` });
    };

    socket.on("existing-users", handleExistingUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("webrtc-offer", handleWebrtcOffer);
    socket.on("webrtc-answer", handleWebrtcAnswer);
    socket.on("webrtc-ice-candidates", handleWebrtcIceCandidates);
    socket.on("user-left", handleUserLeft);
    socket.on("receiveMessage", handleReceiveMessage);

    return () => {
      socket.off("existing-users");
      socket.off("user-joined");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidates");
      socket.off("user-left");
      socket.off("receiveMessage");
    };
  }, [socket, myStream, user]);

  const handleJoin = ({ username, room }) => {
    setUser({ username, room });
    socket.emit("joinRoom", { username, room });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socket.emit("message", { room: user.room, message: newMessage, username: user.username });
      setMessages(prev => [...prev, { username: user.username, message: newMessage }]);
      setNewMessage("");
    }
  };

  const handleCloseNotification = () => {
    setNotification({ open: false, message: '' });
  };

  if (!user) {
    return <Lobby onJoin={handleJoin} />;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', p: 2, boxSizing: 'border-box' }}>
      <Grid container spacing={2}>
        <Grid item xs={9}>
          <Grid container spacing={2}>
            <Grid item xs={6} md={4}>
              {myStream && <VideoPlayer stream={myStream} isMuted={true} username={`${user.username} (You)`} />}
            </Grid>
            {Object.entries(remoteStreams).map(([socketID, data]) => (
              <Grid item xs={6} md={4} key={socketID}>
                {data.stream && <VideoPlayer stream={data.stream} username={data.username} />}
              </Grid>
            ))}
          </Grid>
        </Grid>
        <Grid item xs={3}>
          <Box sx={{
            height: '100%', display: 'flex', flexDirection: 'column',
            border: '1px solid #ddd', borderRadius: '8px', p: 2
          }}>
            <Typography variant="h6" gutterBottom>Chat</Typography>
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
              <List>
                {messages.map((msg, index) => (
                  <ListItem key={index} alignItems="flex-start">
                    <ListItemText
                      primary={msg.username}
                      secondary={msg.message}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
            <Box component="form" onSubmit={handleSendMessage} sx={{ display: 'flex' }}>
              <TextField
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                label="Message"
                fullWidth
                size="small"
              />
              <Button type="submit" variant="contained" sx={{ ml: 1 }}>Send</Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseNotification} severity="info" sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default App;