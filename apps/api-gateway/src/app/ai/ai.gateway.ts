import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AiGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AiGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté au temps réel: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté: ${client.id}`);
  }

  /**
   * Diffuser l'avancement d'un draft IA (Ping Invalidation)
   */
  broadcastDraftUpdate(draftId: string, progressPercent: number) {
    this.server.emit('draft_progress', { draftId, progressPercent });
    this.logger.log(`Broadcast: draft_progress -> ${draftId} à ${progressPercent}%`);
  }

  /**
   * Diffuser l'indexation d'une nouvelle source (Ping Invalidation)
   */
  broadcastSourceUpdate(sourceId: string, status: string) {
    this.server.emit('source_indexed', { sourceId, status });
    this.logger.log(`Broadcast: source_indexed -> ${sourceId} (${status})`);
  }
}
