import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { off } from "process";
const port = 4000;

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket: Socket) => {
    console.log("Client connected", socket.id);

    socket.on("offer", (offer: RTCSessionDescriptionInit) => {
        console.log("Offer recieved");
        socket.broadcast.emit("offer", offer);
    });

    socket.on("answer", (answer: RTCSessionDescriptionInit) => {
        console.log("Answer recieved");
        socket.broadcast.emit("answer", answer);
    });

    socket.on("ice-candidate", (candidate: RTCSessionDescriptionInit) => {
        console.log("Ice candidate recieved");
        socket.broadcast.emit("ice-candidate", candidate);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    })

});

server.listen(port, () => {
    console.log("Server running");

});