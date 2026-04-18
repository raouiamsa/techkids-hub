import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EDU_PATTERNS } from '@org/shared-types';
import { DraftsService } from './drafts.service';
import { SourceType } from '@prisma/client';

@Controller()
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) { }

  /**
   * Création d'un brouillon standard (Synchrone)
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_CREATE)
  async createDraft(@Payload() data: {
    syllabus: string;
    content: string;
    teacherId: string;
    source: { title: string; type: SourceType; url: string };
  }) {
    // 1. On s'assure que la source existe en BDD
    const source = await this.draftsService.upsertSource({
      ...data.source,
    });

    // 2. On crée le brouillon lié
    return this.draftsService.createDraft({
      syllabus: data.syllabus,
      content: data.content,
      teacherId: data.teacherId,
      sourceId: source.id,
    });
  }

  /**
   * Initialisation d'un brouillon en mode "En cours de génération" (0%)
   * Utilisé par l'API Gateway au lancement du pipeline Python.
   */
  @MessagePattern('DRAFTS_CREATE_PROCESSING')
  async createProcessingDraft(@Payload() data: {
    teacherId: string;
    source: { title: string; type: SourceType; url: string };
  }) {
    const source = await this.draftsService.upsertSource({
      ...data.source,
    });

    return this.draftsService.createProcessingDraft({
      teacherId: data.teacherId,
      sourceId: source.id,
    });
  }

  /**
   * Mise à jour de la progression et réception du contenu riche (MoA)
   * Supporte maintenant : syllabus, content, placementBank, certificationBank, finalProject.
   */
  @MessagePattern('DRAFTS_UPDATE_PROGRESS')
  async updateProgress(@Payload() data: {
    id: string;
    progressPercent: number;
    syllabus?: any;
    content?: string;
    placementBank?: any;
    certificationBank?: any;
    finalProject?: any;
    aiScore?: number;
  }) {
    return this.draftsService.updateDraftProgress(
      data.id,
      data.progressPercent,
      data.syllabus,
      data.content,
      data.placementBank,
      data.certificationBank,
      data.finalProject,
      data.aiScore
    );
  }

  /**
   * Liste tous les brouillons d'un enseignant spécifique
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_LIST)
  async getDrafts(@Payload() data: { teacherId: string }) {
    return this.draftsService.getTeacherDrafts(data.teacherId);
  }

  /**
   * Récupère les détails d'un brouillon (pour le polling du Frontend)
   */
  @MessagePattern('DRAFTS_GET')
  async getDraft(@Payload() data: { draftId: string }) {
    return this.draftsService.getDraft(data.draftId);
  }

  /**
   * Publication : Transforme le brouillon en un cours réel et actif
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_PUBLISH)
  async publish(@Payload() data: { draftId: string }) {
    return this.draftsService.publish(data.draftId);
  }

  /**
   * Rejet / Suppression du brouillon
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_DELETE)
  async delete(@Payload() data: { draftId: string }) {
    return this.draftsService.deleteDraft(data.draftId);
  }
}