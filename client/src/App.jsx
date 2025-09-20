import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from "socket.io-client";
import { Box, Grid, Snackbar, Alert, Typography, TextField, Button, List, ListItem, ListItemText, LinearProgress } from "@mui/material";
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
  const [progress, setProgress] = useState(100);

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
    if (notification.open) {
      setProgress(100);
      const timer = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress <= 0) {
            clearInterval(timer);
            return 0;
          }
          return prevProgress - 5; // Adjusted for 2-second duration
        });
      }, 100);

      return () => {
        clearInterval(timer);
      };
    }
  }, [notification.open]);

  useEffect(() => {
    if (!socket || !myStream || !user) return;

    const createPeerConnection = (socketID, username) => {
      if (peerConnections.current[socketID]) return;
      
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
      socket.emit("webrtc-offer", { offer, to: socketID, username: user.username });
    };

    const handleExistingUsers = (users) => {
      users.forEach(u => callUser(u.id, u.username));
    };
    
    const handleUserJoined = ({ username }) => {
        setNotification({ open: true, message: `${username} joined the room.` });
    };

    const handleWebrtcOffer = async ({ offer, from, username }) => {
      createPeerConnection(from, username);
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
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
  {/* Video Section */}
  <Box sx={{ flexGrow: 1, p: 1, overflowY: 'auto' }}>
    <Grid container spacing={2}>
      {/* My video */}
      <Grid item >
        {myStream && (
          <Box sx={{width:450, height:310}}>
            <VideoPlayer
            stream={myStream}
            isMuted={true}
            username={`${user.username} (You)`}
          />
          </Box>
          
        )}
      </Grid>

      {/* Remote videos */}
      {Object.entries(remoteStreams).map(([socketID, data]) => (
        <Grid item key={socketID}>
          {data.stream && (
            <Box sx={{ width: 450, height: 310 }}>
              <VideoPlayer stream={data.stream} username={data.username} />
            </Box>
          )}
        </Grid>
      ))}
    </Grid>
  </Box>

  {/* Chat Section */}
  <Box
    sx={{
      width: '20%',
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #ddd',
      bgcolor: 'white',
    }}
  >
    {/* Header */}
    <Typography
      variant="h6"
      gutterBottom
      sx={{ p: 2, flexShrink: 0, borderBottom: '1px solid #eee' }}
    >
      Chat
    </Typography>

    {/* Messages List */}
    <Box
      sx={{
        flexGrow: 1,
        overflowY: 'auto',
        px: 2,
        py: 1,
      }}
    >
      <List>
        {messages.map((msg, index) => (
          <ListItem
            key={index}
            sx={{
              bgcolor: index % 2 ? '#f5f5f5' : 'transparent',
              borderRadius: '8px',
              mb: 1,
              p: 1,
            }}
          >
            <ListItemText
              primary={
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  {msg.username}
                </Typography>
              }
              secondary={msg.message}
            />
          </ListItem>
        ))}
      </List>
    </Box>

    {/* Input */}
    <Box
      component="form"
      onSubmit={handleSendMessage}
      sx={{
        display: 'flex',
        p: 2,
        borderTop: '1px solid #e2e2e2ff',
        flexShrink: 0,
      }}
    >
      <TextField
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        label="Message"
        fullWidth
        size="small"
        variant="outlined"
      />
      <Button type="submit" variant="contained" sx={{ ml: 1 }}>
        Send
      </Button>
    </Box>
  </Box>
  {/* Snackbar for Notifications */}
<Snackbar
    open={notification.open}
    autoHideDuration={2000}
    onClose={handleCloseNotification}
    anchorOrigin={{ vertical: "top", horizontal: "right" }}
>
    <Alert
      onClose={handleCloseNotification}
      severity="info"
      sx={{ width: "100%", position: "relative" }}
    >
      {notification.message}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ 
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0
        }}
      />
    </Alert>
</Snackbar>
</Box>

  );
};

export default App;