/**
 * libs/messaging/src/lib/messaging.service.ts
 *
 * Service partagé pour publier des événements vers RabbitMQ.
 *
 * Usage dans n'importe quel service :
 *   constructor(private readonly messaging: MessagingService) {}
 *   this.messaging.publish(EVENTS.ORDER_COMPLETED, { orderId, userId });
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);

    constructor(
        @Inject('RABBITMQ_CLIENT') private readonly client: ClientProxy,
    ) { }

    /**
     * Publie un événement dans la queue RabbitMQ (fire-and-forget).
     * @param event   Nom de l'événement — utiliser les constantes EVENTS.XXX
     * @param payload Données JSON à transmettre
     */
    publish<T>(event: string, payload: T): void {
        this.logger.log(`Publishing event: "${event}"`);
        this.client.emit(event, payload).subscribe({
            error: (err: unknown) =>
                this.logger.error(`Failed to publish "${event}": ${String(err)}`),
        });
    }
}
