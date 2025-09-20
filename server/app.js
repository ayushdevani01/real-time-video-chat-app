import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";

const port = 4000;
const app = express();
app.use(cors());
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

const users = {}; // { room: [{ id, username }] }

io.on("connection", (socket) => {
  console.log("User connected.", socket.id);

  socket.on("joinRoom", ({ room, username }) => {
    socket.join(room);
    console.log(`User ${username} (${socket.id}) joined room ${room}`);

    if (!users[room]) {
      users[room] = [];
    }

    socket.emit("existing-users", users[room]);
    users[room].push({ id: socket.id, username });

    socket.broadcast.to(room).emit("user-joined", { id: socket.id, username });
  });



  socket.on("message", ({ room, message, username }) => {
    socket.to(room).emit("receiveMessage", { message, username, id: socket.id });
  });

  socket.on("webrtc-offer", ({ offer, to, username }) => {
    io.to(to).emit("webrtc-offer", { offer, from: socket.id, username });
});

  socket.on("webrtc-answer", ({ answer, to }) => {
    io.to(to).emit("webrtc-answer", { answer, from: socket.id });
  });

  socket.on("webrtc-ice-candidates", ({ candidate, to }) => {
    io.to(to).emit("webrtc-ice-candidates", { candidate, from: socket.id });
  });

  socket.on("disconnect", () => {
    console.log(`${socket.id} disconnected!`);
    let disconnectedUser = null;
    for (const room in users) {
      const userIndex = users[room].findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        disconnectedUser = users[room][userIndex];
        users[room].splice(userIndex, 1);
        io.to(room).emit("user-left", disconnectedUser.id);
        break;
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});