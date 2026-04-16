import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EDU_PATTERNS } from '@org/shared-types';
import { LibraryService } from './library.service';

@Controller()
export class LibraryController {
  private readonly logger = new Logger(LibraryController.name);

  constructor(private readonly libraryService: LibraryService) {}

  @MessagePattern(EDU_PATTERNS.CONTENT_SOURCES_CREATE)
  async createContentSource(@Payload() data: { title: string; url: string; type: any; teacherId: string }) {
    this.logger.log(`TCP Réception: Création source ${data.title}`);
    return this.libraryService.createContentSource(data);
  }

  @MessagePattern(EDU_PATTERNS.CONTENT_SOURCES_LIST)
  async getSources(@Payload() data: { teacherId: string }) {
    this.logger.log(`TCP Réception: Liste des sources`);
    return this.libraryService.getSources();
  }

  @MessagePattern(EDU_PATTERNS.CONTENT_SOURCES_DELETE)
  async deleteSource(@Payload() data: { sourceId: string }) {
    this.logger.log(`TCP Réception: Suppression source ${data.sourceId}`);
    return this.libraryService.deleteSource(data.sourceId);
  }

  @MessagePattern(EDU_PATTERNS.CONTENT_SOURCES_UPDATE_STATUS)
  async updateIndexingStatus(@Payload() data: { sourceId: string; status: 'INDEXING' | 'READY' | 'ERROR' }) {
    this.logger.log(`TCP Réception: Mise à jour statut source ${data.sourceId} → ${data.status}`);
    return this.libraryService.updateIndexingStatus(data.sourceId, data.status);
  }
}
