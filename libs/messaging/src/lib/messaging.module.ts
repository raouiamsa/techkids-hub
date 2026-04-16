/**
 * libs/messaging/src/lib/messaging.module.ts
 *
 * Configure la connexion RabbitMQ.
 * Importer ce module dans tout service qui veut publier des événements.
 */

import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MessagingService } from './messaging.service';
import { QUEUES } from './messaging.constants';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'RABBITMQ_CLIENT',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env['RABBITMQ_URL'] || 'amqp://techkids:techkids@localhost:5672/'],
                    queue: QUEUES.MAIN,
                    queueOptions: {
                        durable: true, // La queue survit au redémarrage de RabbitMQ
                    },
                },
            },
        ]),
    ],
    providers: [MessagingService],
    exports: [MessagingService, ClientsModule],  // Export ClientsModule pour que RABBITMQ_CLIENT soit injectable
})
export class MessagingModule { }
