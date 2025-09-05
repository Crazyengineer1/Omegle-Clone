import express from "express";
import https from "https";
import fs from "fs";
import { Server, Socket } from "socket.io";
import cors from "cors";

const port = 4000;
const app = express();
app.use(cors());

const privateKey = fs.readFileSync("./certificates/localhost+2-key.pem", "utf8");
const certificate = fs.readFileSync("./certificates/localhost+2.pem", "utf8");


const server = https.createServer(
    { key: privateKey, cert: certificate },
    app);

const io = new Server(server, {
    cors: {
        // origin: ["http://localhost:4500", "http://192.168.129.222:4500"],
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let waitingSocket: Socket | null = null;

io.on("connection", (socket: Socket) => {
    console.log("Client connected", socket.id);

    socket.on("start-call", () => {
        if (waitingSocket?.id === socket.id) {
            console.log("User tried to match with themselves—ignoring.");
            return;
        }
        if (!waitingSocket) {
            waitingSocket = socket;
            socket.emit("waiting");
        } else {
            // Match found
            socket.emit("matched", { peerId: waitingSocket.id });
            waitingSocket.emit("matched", { peerId: socket.id });
            waitingSocket = null;
        }
    });

    socket.on("offer", ({ offer, to }) => {
        io.to(to).emit("offer", { offer, from: socket.id });
    });

    socket.on("answer", ({ answer, to }) => {
        io.to(to).emit("answer", { answer, from: socket.id });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
        io.to(to).emit("ice-candidate", { candidate, from: socket.id });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
        if (waitingSocket?.id === socket.id) {
            waitingSocket = null;
        }
    });
});

server.listen(port, () => {
    console.log("Server running");
});
