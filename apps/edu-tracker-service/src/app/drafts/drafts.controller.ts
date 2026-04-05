import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EDU_PATTERNS } from '@org/shared-types';
import { DraftsService } from './drafts.service';
import { SourceType } from '@prisma/client';

@Controller()
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @MessagePattern(EDU_PATTERNS.DRAFTS_CREATE)
  async createDraft(@Payload() data: {
    syllabus: string;
    content: string;
    teacherId: string;
    source: { title: string; type: SourceType; url: string };
  }) {
    // 1. On upsert la source d'abord
    const source = await this.draftsService.upsertSource({
       ...data.source,
    });

    // 2. On crée le brouillon lié à cette source
    return this.draftsService.createDraft({
      syllabus: data.syllabus,
      content: data.content,
      teacherId: data.teacherId,
      sourceId: source.id,
    });
  }

  @MessagePattern(EDU_PATTERNS.DRAFTS_LIST)
  async getDrafts(@Payload() data: { teacherId: string }) {
    return this.draftsService.getTeacherDrafts(data.teacherId);
  }

  @MessagePattern(EDU_PATTERNS.DRAFTS_PUBLISH)
  async publish(@Payload() data: { draftId: string }) {
    return this.draftsService.publish(data.draftId);
  }

  @MessagePattern(EDU_PATTERNS.DRAFTS_DELETE)
  async delete(@Payload() data: { draftId: string }) {
    return this.draftsService.deleteDraft(data.draftId);
  }
}
