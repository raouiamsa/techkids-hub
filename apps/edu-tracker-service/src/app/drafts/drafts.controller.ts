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
   * Utilisé pour les créations directes où la source est envoyée en entier.
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_CREATE)
  async createDraft(@Payload() data: {
    syllabus: string;
    content: string;
    teacherId: string;
    source: { title: string; type: SourceType; url: string };
  }) {
    // 1. On s'assure que la source existe en BDD (Upsert)
    const source = await this.draftsService.upsertSource({ ...data.source });

    // 2. On crée le brouillon lié à cet ID
    return this.draftsService.createDraft({
      syllabus: data.syllabus,
      content: data.content,
      teacherId: data.teacherId,
      sourceId: source.id,
    });
  }

  /**
   *  INITIALISATION ASYNCHRONE (0%)
   */
  @MessagePattern('DRAFTS_CREATE_PROCESSING')
  async createProcessingDraft(@Payload() data: {
    teacherId: string;
    sourceId: string; // L'ID réel du PDF dans la bibliothèque
    title: string;    // Le sujet du cours saisi par le prof
  }) {
    // Appel direct au service avec le mappage correct des champs
    return this.draftsService.createProcessingDraft({
      teacherId: data.teacherId,
      existingSourceId: data.sourceId,
      title: data.title
    });
  }

  /**
   * RECTIFICATION (Human-in-the-loop)
   * Reçoit la demande de correction pour relancer rédacteur.
   */
  @MessagePattern('DRAFTS_RECTIFY')
  async rectify(@Payload() data: { draftId: string; feedback: string }) {
    return this.draftsService.rectifyDraft(data.draftId, data.feedback);
  }

  /**
   * TÉLÉMÉTRIE & CONTENU RICHE
   * Reçoit la progression et les banques de données (Placement, Certification, Projet).
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
   *  GESTION CRUD
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_LIST)
  async getDrafts(@Payload() data: { teacherId: string }) {
    return this.draftsService.getTeacherDrafts(data.teacherId);
  }

  @MessagePattern('DRAFTS_GET')
  async getDraft(@Payload() data: { draftId: string }) {
    return this.draftsService.getDraft(data.draftId);
  }

  /**
   *  PUBLICATION
   * Transforme le brouillon JSON en vrais Modules et Exercices dans le LMS.
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_PUBLISH)
  async publish(@Payload() data: { draftId: string }) {
    return this.draftsService.publish(data.draftId);
  }

  /**
   *  SUPPRESSION
   */
  @MessagePattern(EDU_PATTERNS.DRAFTS_DELETE)
  async delete(@Payload() data: { draftId: string }) {
    return this.draftsService.deleteDraft(data.draftId);
  }
}