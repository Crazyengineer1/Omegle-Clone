import express from "express";
import https from "https";
import http from "http";
import fs from "fs";
import { Server, Socket } from "socket.io";
import cors from "cors";

const port = 4000;
const app = express();
app.use(cors());

// const privateKey = fs.readFileSync("./certificates/localhost+2-key.pem", "utf8");
// const certificate = fs.readFileSync("./certificates/localhost+2.pem", "utf8");


// const server = https.createServer(
//     { key: privateKey, cert: certificate },
//     app);

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        // origin: ["http://localhost:4500", "http://192.168.000.000:4500"],
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let waitingQueue: Socket[] = [];
const activePairs = new Map<string, string>();

io.on("connection", (socket: Socket) => {
    console.log("Client connected", socket.id);

    socket.on("start-call", () => {
        if (waitingQueue.length == 0) {
            waitingQueue.push(socket);
            socket.emit("waiting");
        }
        else {
            const s1 = waitingQueue.shift();
            if (s1) {
                socket.emit("matched", { peerId: s1.id, role: "caller" });
                s1.emit("matched", { peerId: socket.id, role: "calle" });

                activePairs.set(s1.id, socket.id);
                activePairs.set(socket.id, s1.id);
            } else {
                console.error("Error matchmaking");
            }
        }
    });

    socket.on("early-cut", () => {
        const index = waitingQueue.indexOf(socket);
        if (index != -1) {
            waitingQueue.splice(index, 1);
        }
    })

    socket.on("offer", ({ offer, to }) => {
        io.to(to).emit("offer", { offer, from: socket.id });
    });

    socket.on("answer", ({ answer, to }) => {
        io.to(to).emit("answer", { answer, from: socket.id });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
        io.to(to).emit("ice-candidate", { candidate, from: socket.id });
    });

    socket.on("end-call", ({ to }) => {
        const peerID = activePairs.get(socket.id);
        if (peerID) {
            io.to(peerID).emit("call-ended", { from: socket.id });
            activePairs.delete(socket.id);
            activePairs.delete(peerID);
        }
        io.to(to).emit("call-ended", { from: socket.id });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
        const index = waitingQueue.indexOf(socket);
        if (index != -1) {
            waitingQueue.splice(index, 1);
        }
        const peerID = activePairs.get(socket.id);
        if (peerID) {
            io.to(peerID).emit("call-ended", { from: socket.id });
            activePairs.delete(socket.id);
            activePairs.delete(peerID);
        }

    });
});

server.listen(port, () => {
    console.log("Server running");
});
