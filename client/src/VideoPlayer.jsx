import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';

const VideoPlayer = ({ stream, isMuted = false, username }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <Box sx={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        style={{ width: '100%', display: 'block' }}
      />
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
        }}
      >
        {username}
      </Typography>
    </Box>
  );
};

export default VideoPlayer;