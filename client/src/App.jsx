import React from 'react'
import { useEffect, useMemo } from 'react';
import { io } from "socket.io-client";
import {Container,TextField,Button} from "@mui/material";
import { useState } from 'react';
import { useRef } from 'react';

const App = () => {
  const socket=useMemo(()=>io("http://localhost:4000/"),[]);
  // const socket=io("http://localhost:4000/");
  const [message,setMessage]=useState("");
  const [room,setRoom]=useState("");
  const [socketid,setSocketId]=useState("123");
  const [messages,setMessages]=useState([]);
  const peerConnection=useRef();
  const [myStream,setMystream]=useState(null);
  const myVideo=useRef();
  const remoteVideo=useRef();
  const [remoteStream,setRemoteStream]=useState(null);

  const handleSubmit=(e)=>{
    e.preventDefault();
    socket.emit("message",{room,socketid,message});
    setMessage("");
  };

  const handleRoomSubmit=(e)=>{
    e.preventDefault();
    socket.emit("joinRoom",room);
    // setRoom("");
  };

  useEffect(()=>{
    if(remoteStream&&remoteVideo.current){
      remoteVideo.current.srcObject=remoteStream;
    }
  },[remoteStream]);

  useEffect(() => {
  console.log("Messages state changed:", messages);
}, [messages]);

useEffect(() => {
  if (myVideo.current && myStream) {
    myVideo.current.srcObject = myStream;
  }
}, [myStream]);


  useEffect(()=>{
    
    const initMedia=async ()=>{
      let stream=null;
      try{

        stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
        setMystream(stream);
        
      }catch(err){
        console.error(err);
      }
    };

    const createPeerConnection=(id)=>{
        if(peerConnection.current){
            console.log("peerconncetion already exists!!");
            return peerConnection.current;
        }

        const pc=new RTCPeerConnection({
            iceServers:[
              {
                urls:[
                  "stun:stun.l.google.com:19302",
                  "stun:stun1.l.google.com:19302",
                ]
              }
            ]
        });
        
        pc.onicecandidate=(event)=>{
          if(event.candidate){
             console.log("Generated ICE candidate:", event.candidate);
            socket.emit("webrtc-ice-candidates",{candidate:event.candidate,to:id});
          }
        };

        pc.ontrack=(event)=>{
          const [stream]=event.streams;
          setRemoteStream(stream);
        }

        if(myStream)myStream.getTracks().forEach((track)=>{
          pc.addTrack(track,myStream);
        });

        peerConnection.current=pc;
        return pc;
    };

    const socketListeners=()=>{

    socket.on("connect",()=>{
    setSocketId(socket.id);
    console.log("connected",socket.id);
    })

    socket.on("welcome",(msg)=>{
      console.log(msg);
    })

    socket.on("reciveMessage",(data)=>{
      console.log(data.socketid,data.message);
      setMessages((prev) => {
      const updated = [...prev, data];
      return updated;
      });
    });

    socket.on("user-joined",async (id)=>{
        console.log("A new user joined with id = ",id);

        // if(!myStream)return;
        const pc=createPeerConnection(id);
        const offer=await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer",{offer:offer,to:id});

    });

    socket.on("webrtc-ice-candidates",async ({candidate,from})=>{
      console.log(`Recieved and ice candidate from ${from}.`);
      
      if(peerConnection.current){
        await peerConnection.current.addIceCandidate(candidate);
      }
    });

    socket.on("webrtc-offer",async ({offer,from})=>{
      console.log("Recieved an offer from ",from);

      const pc=createPeerConnection(from);
      await pc.setRemoteDescription(offer);

      const answer=await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc-answer",{answer:answer,to:from});
    });

    socket.on("webrtc-answer",async ({answer,from})=>{

      console.log("Recieved and answer fron ",from);

      if(peerConnection.current){
        await peerConnection.current.setRemoteDescription(answer);
        console.log("Connection established with:",from);
      }
    });
    };

    initMedia();
    socketListeners();

    return ()=>{
      socket.off();
      if(peerConnection.current){
        peerConnection.current.close();
        peerConnection.current=null;
      }
    };

  } ,[socket]);


  return (
    <Container>
      <h1>Welcome!!</h1>

      <h4>Your id is = {socketid}</h4>
      <hr/>

      <div>
        <h4>My Video</h4>
        {myStream&&<video ref={myVideo} autoPlay playsInline muted height="300px" width="500px"/>}
      </div>
      <hr/>
      <div>
        <h4>Remote Video</h4>
        {remoteStream&&<video ref={remoteVideo} autoPlay playsInline height="300px" width="500px"/>}
      </div>
      <hr/>
      <form onSubmit={handleRoomSubmit}>
        <TextField value={room} label="RoomName"onChange={(e)=>setRoom(e.target.value)}/>
          <Button type="submit" >
            Join Room.
          </Button>
      </form>
      <hr/>
      <form onSubmit={handleSubmit}>
        <TextField value={message} label="Message"onChange={(e)=>setMessage(e.target.value)}/>
          <Button type="submit" >
            Send!
          </Button>
      </form>

      <div>
        <ul>
          {messages.map((m,i) => (
            <li key={i}>
              <b>{m.socketid}</b>: {m.message}
            </li>
          ))}
        </ul>
      </div>
    </Container>
  )
}
export default App;
