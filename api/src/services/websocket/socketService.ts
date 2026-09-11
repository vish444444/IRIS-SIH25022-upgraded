import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

export class SocketService {
  private io: SocketIOServer;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.io.on("connection", (socket: Socket) => {
      console.log("Client connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });
  }

  emitEmergency(emergency: any): void {
    this.io.emit("emergency_alert", emergency);
  }

  stop(): void {
    // No-op for now, can be used for cleanup if needed
  }
}

