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
        // origin: ["http://localhost:4500", "http://192.168.129.222:4500"],
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// let waitingSocket: Socket | null = null;
let waitingQueue: Socket[] = [];

io.on("connection", (socket: Socket) => {
    console.log("Client connected", socket.id);

    socket.on("start-call", () => {
        if (waitingQueue.length == 0) {
            waitingQueue.push(socket);
            socket.emit("waiting");
        }
        else {
            waitingQueue.push(socket);
            const s1 = waitingQueue.shift();
            const s2 = waitingQueue.shift();
            if (s1 && s2) {
                s1.emit("matched", { peerId: s2.id });
                s2.emit("matched", { peerId: s1.id });
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
        io.to(to).emit("call-ended", { from: socket.id });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
    });
});

server.listen(port, () => {
    console.log("Server running");
});
