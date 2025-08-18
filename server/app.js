import express from "express";
import { Server } from "socket.io";
import {createServer} from "http";
import cors from "cors";


const port=4000;
const app=express();
app.use(cors());
const server=createServer(app);
const io=new Server(server,{
    cors:{
        origin:"*",
        credentials:true,
    }
});

app.get("/",()=>{
    console.log("app");
});

io.on("connection",(socket)=>{
    
    console.log("User connected.",socket.id);

    socket.on("message",(data)=>{
        console.log(data);
        io.to(data.room).emit("reciveMessage",data);
    });

    socket.on("joinRoom",(room)=>{
        socket.join(room);
        console.log(`User joined the room ${room}`);

        socket.broadcast.to(room).emit("user-joined",socket.id);
    });

    socket.on("webrtc-offer",({offer,to})=>{
        io.to(to).emit("webrtc-offer",{offer:offer,from:socket.id});
    });

    socket.on("webrtc-answer",({answer,to})=>{
        io.to(to).emit("webrtc-answer",{answer,from:socket.id});
    });

    socket.on("webrtc-ice-candidates",({candidate,to})=>{
        console.log("Relaying ICE candidate to:", to);
        io.to(to).emit("webrtc-ice-candidates",{candidate,from:socket.id});
    });

    socket.on("disconnect",()=>{
        console.log(`${socket.id} disconnected!`);
    });

});

server.listen(port,()=>{
    console.log("hi");
});