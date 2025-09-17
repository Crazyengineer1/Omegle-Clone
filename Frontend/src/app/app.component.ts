import { Component, ElementRef, ViewChild } from '@angular/core';
import { io } from 'socket.io-client';
import { FooterComponent } from './footer/footer.component';
import { environment } from '../environments/environment';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [FooterComponent],
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;

  private socket = io(environment.backendUrl);
  private peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  currentPeerId: string | null = null;

  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isCaller = false;
  private localStream: MediaStream | null = null;

  isCallStarted = false;

  constructor(private titleService: Title) {
    this.listenToSocketEvents();
    this.listenToPeerEvents();
  }

  async startCall() {
    this.titleService.setTitle("Starting call");
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.displayLocalStream(this.localStream);
    this.addTracksToPeer(this.localStream);
    this.isCallStarted = true;
    this.socket.emit("start-call");
  }

  async cutCall() {
    if (this.currentPeerId) {
      this.titleService.setTitle("Call ended");
      // console.log("Call ended");
      this.socket.emit("end-call", { to: this.currentPeerId });
    }

    if (this.peer) {
      this.peer.getSenders().forEach(sender => sender.track?.stop());
      this.peer.close();
    }

    if (!this.currentPeerId) {
      this.socket.emit("early-cut");
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.localVideoRef.nativeElement.srcObject = null;
    this.remoteVideoRef.nativeElement.srcObject = null;

    this.currentPeerId = null;
    this.isCallStarted = false;

    this.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.listenToPeerEvents();
  }

  skipCall() {
    this.cutCall();
    this.startCall();
  }

  private listenToSocketEvents() {
    this.socket.on("waiting", () => {
      this.titleService.setTitle("Waiting for another user");
      // console.log("Waiting for another user...");
    });

    this.socket.on("matched", async ({ peerId, role }) => {
      this.titleService.setTitle("Ongoing call");
      // console.log("Matched with", peerId);
      this.currentPeerId = peerId;

      if (role === "caller") {
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        this.socket.emit("offer", { offer, to: peerId });
      }
    });

    this.socket.on("offer", async ({ offer, from }) => {
      if (this.peer.signalingState !== "stable") {
        console.warn("Skipping offer, wrong state", this.peer.signalingState);
        return;
      }
      await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
      for (const c of this.pendingCandidates) {
        await this.peer.addIceCandidate(c);
      }
      this.pendingCandidates = [];
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer);
      this.socket.emit("answer", { answer, to: from });
    });


    this.socket.on("answer", async ({ answer }) => {
      if (!this.peer.currentRemoteDescription) {
        await this.peer.setRemoteDescription(new RTCSessionDescription(answer));
        for (const c of this.pendingCandidates) {
          await this.peer.addIceCandidate(c);
        }
        this.pendingCandidates = [];
      }
    });

    this.socket.on("ice-candidate", async ({ candidate, to }) => {
      try {
        if (!candidate) return;
        if (!this.peer.remoteDescription) {
          // console.log("Buffering ICE candidate until remote description is set");
          this.pendingCandidates.push(candidate);
        } else {
          await this.peer.addIceCandidate(candidate);
        }
      } catch (err) {
        console.error("Error adding received ice candidate", err);
      }
    });

    this.socket.on("call-ended", async ({ from }) => {
      // console.log("Call ended by peer:", from);

      if (this.peer) {
        this.peer.getSenders().forEach(sender => sender.track?.stop());
        this.peer.close();
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      this.localVideoRef.nativeElement.srcObject = null;
      this.remoteVideoRef.nativeElement.srcObject = null;

      this.currentPeerId = null;
      this.isCallStarted = false;

      this.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      this.listenToPeerEvents();
    });
  }

  private listenToPeerEvents() {
    this.peer.ontrack = (event) => {
      const [stream] = event.streams;
      this.remoteVideoRef.nativeElement.srcObject = stream;
    };

    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        // console.log(event.candidate);
        this.socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: this.currentPeerId
        });
      }
    };
  }

  private displayLocalStream(stream: MediaStream) {
    this.localVideoRef.nativeElement.srcObject = stream;
    this.localVideoRef.nativeElement.muted = true;
  }

  private addTracksToPeer(stream: MediaStream) {
    stream.getTracks().forEach(track => {
      this.peer.addTrack(track, stream);
    });
  }

}
