import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Paper } from '@mui/material';

const Lobby = ({ onJoin }) => {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && room) {
      onJoin({ username, room });
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Paper elevation={3} sx={{ padding: 4, width: '100%', maxWidth: '400px' }}>
        <Typography variant="h5" gutterBottom>
          Join a Room
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Your Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            required
            margin="normal"
          />
          <TextField
            label="Room Name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            fullWidth
            required
            margin="normal"
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
            Join
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Lobby;