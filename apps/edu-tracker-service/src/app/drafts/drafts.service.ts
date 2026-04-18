import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { DraftStatus, SourceType } from '@prisma/client';

@Injectable()
export class DraftsService {
  private readonly logger = new Logger(DraftsService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Créer ou mettre à jour une source de contenu (PDF, URL)
   */
  async upsertSource(data: { title: string; type: SourceType; url: string; courseId?: string }) {
    this.logger.log(`Upsert source: ${data.title}`);
    return this.prisma.contentSource.upsert({
      where: { url: data.url },
      update: { title: data.title },
      create: { ...data },
    });
  }

  /**
   * Initialise un brouillon en statut PROCESSING (0%)
   */
  async createProcessingDraft(data: { teacherId: string; sourceId: string }) {
    this.logger.log(`Création d'un brouillon PROCESSING pour le prof: ${data.teacherId}`);
    return this.prisma.generatedDraft.create({
      data: {
        teacherId: data.teacherId,
        sourceId: data.sourceId,
        status: DraftStatus.PROCESSING,
        progressPercent: 0,
      },
    });
  }

  /**
   * Met à jour la progression et enregistre le contenu riche au fur et à mesure
   * Supporte : syllabus, content (array), placementBank, certificationBank, finalProject
   */
  async updateDraftProgress(
    id: string,
    progress: number,
    syllabus?: any,
    content?: string,
    placementBank?: any,
    certificationBank?: any,
    finalProject?: any,
    aiScore?: number
  ) {
    this.logger.log(`Mise à jour du brouillon ${id} : ${progress}%`);

    // Préparation des données de mise à jour
    const updateData: any = {
      progressPercent: progress
    };

    // Si on a des données partielles ou finales, on les sérialise si nécessaire
    if (syllabus) updateData.syllabus = typeof syllabus === 'string' ? syllabus : JSON.stringify(syllabus);

    // Pour le content, on utilise 'push' car c'est un tableau de strings dans le schéma
    if (content) updateData.content = { push: content };

    // On stocke les banques et le projet (souvent envoyés en fin de processus)
    if (placementBank) updateData.placementBank = typeof placementBank === 'string' ? placementBank : JSON.stringify(placementBank);
    if (certificationBank) updateData.certificationBank = typeof certificationBank === 'string' ? certificationBank : JSON.stringify(certificationBank);
    if (finalProject) updateData.finalProject = typeof finalProject === 'string' ? finalProject : JSON.stringify(finalProject);
    if (aiScore !== undefined && aiScore !== null) updateData.aiScore = aiScore;

    // Si on atteint 100%, on passe en attente de révision
    if (progress >= 100) {
      updateData.status = DraftStatus.PENDING_REVIEW;
    }

    return this.prisma.generatedDraft.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Créer un brouillon (Méthode synchrone historique)
   */
  async createDraft(data: {
    syllabus: any;
    content: string;
    teacherId: string;
    sourceId: string;
  }) {
    this.logger.log(`Création synchrone pour le prof: ${data.teacherId}`);
    return this.prisma.generatedDraft.create({
      data: {
        syllabus: typeof data.syllabus === 'string' ? data.syllabus : JSON.stringify(data.syllabus),
        content: [data.content],
        teacherId: data.teacherId,
        sourceId: data.sourceId,
        status: DraftStatus.PENDING_REVIEW,
        progressPercent: 100
      },
    });
  }

  async getTeacherDrafts(teacherId: string) {
    return this.prisma.generatedDraft.findMany({
      where: { teacherId },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDraft(id: string) {
    return this.prisma.generatedDraft.findUnique({
      where: { id },
      include: { source: true },
    });
  }

  async deleteDraft(id: string) {
    this.logger.log(`Suppression du brouillon ${id}`);
    return this.prisma.generatedDraft.delete({
      where: { id },
    });
  }

  /**
   * 🚀 PUBLICATION : Transforme le Brouillon JSON en entités Course/Module/Exercise
   */
  async publish(draftId: string) {
    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
      include: { source: true },
    });

    if (!draft) throw new Error('Brouillon introuvable');
    this.logger.log(`Publication du brouillon ${draftId} vers le LMS...`);

    // 1. Parsing du contenu (On prend la dernière version du tableau content)
    let courseData: any = {};
    try {
      const contentArray = draft.content as any[] | null;
      if (!contentArray || contentArray.length === 0) {
        throw new Error('Contenu vide');
      }
      const rawContent = contentArray[contentArray.length - 1];
      courseData = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    } catch (e) {
      this.logger.warn('Erreur de parsing JSON, utilisation des métadonnées de secours.');
      courseData = { courseTitle: (draft as any).title || draft.source?.title || 'Cours IA', modules: [] };
    }

    const modules = courseData.modules || [];
    const title = courseData.courseTitle || draft.title || draft.source?.title || 'Sans titre';

    // 2. CRÉATION DU COURS FINAL
    const course = await this.prisma.course.create({
      data: {
        title: title,
        description: courseData.objectives?.join('. ') || `Cours de niveau ${courseData.level || 'Standard'}`,
        teacherId: draft.teacherId,
        isPublished: true,
        // On transfère les banques et le projet (undefined si null pour éviter l'erreur Prisma Json)
        placementBank: draft.placementBank ?? undefined,
        certificationBank: draft.certificationBank ?? undefined,
        finalProject: draft.finalProject ?? undefined,
      },
    });

    // 3. CRÉATION DES MODULES ET EXERCICES
    for (const [idx, m] of modules.entries()) {
      const createdModule = await this.prisma.module.create({
        data: {
          title: m.title || `Module ${idx + 1}`,
          order: m.order || idx + 1,
          content: m.content || '',
          courseId: course.id,
        },
      });

      // Insertion des exercices Text/Quiz
      const exercisesText = m.exercises_text || [];
      for (const ex of exercisesText) {
        await this.prisma.exercise.create({
          data: {
            title: ex.title || 'Quiz de révision',
            instructions: JSON.stringify(ex.questions || ex),
            exerciseType: (ex.type === 'CODE' ? 'CODE_CHALLENGE' : 'QUIZ') as any,
            moduleId: createdModule.id,
          },
        });
      }

      // Insertion des exercices de Code (Qwen)
      const exercisesCode = m.exercises_code || [];
      for (const codeEx of exercisesCode) {
        await this.prisma.exercise.create({
          data: {
            title: codeEx.title || 'Défi de programmation',
            instructions: codeEx.instructions || '',
            solution: codeEx.solution || '',
            exerciseType: 'CODE_CHALLENGE',
            moduleId: createdModule.id,
          },
        });
      }
    }

    // 4. ARCHIVAGE DU BROUILLON
    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: { status: DraftStatus.APPROVED },
    });

    return { courseId: course.id, success: true };
  }
}