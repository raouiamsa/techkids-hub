import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { DraftStatus, SourceType, CourseLevel, ExerciseType } from '@prisma/client';

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
      create: {
        title: data.title,
        type: data.type,
        url: data.url,
        indexingStatus: 'READY'
      },
    });
  }
  async createProcessingDraft(data: { teacherId: string; existingSourceId: string; title: string; initialPrompt?: string }) {
    this.logger.log(`Création d'un brouillon PROCESSING pour le prof: ${data.teacherId}`);
    return this.prisma.generatedDraft.create({
      data: {
        title: data.title, // Sauvegarde du sujet du cours
        initialPrompt: data.initialPrompt, //  Stockage du Bundle (Sujet + Âge + Niveau) pour le Dataset IA
        teacherId: data.teacherId,
        sourceId: data.existingSourceId, //  Utilisation du bon champ Prisma
        status: DraftStatus.PROCESSING,
        progressPercent: 0,
      },
    });
  }

  /**
   * 🌟 LOGIQUE DE RECTIFICATION (Human-in-the-loop & Fine-tuning)
   * Remet le draft en mode rédaction avec le feedback prof et l'enregistre pour l'entraînement.
   */
  async rectifyDraft(id: string, feedback: string, moduleFeedbacks?: any) {
    this.logger.log(`Rectification demandée pour le brouillon ${id}`);

    return this.prisma.generatedDraft.update({
      where: { id },
      data: {
        generalFeedback: feedback, //  Sauvegarde du Noud général pour le Dataset
        moduleFeedbacks: moduleFeedbacks || {}, //  Sauvegarde du Noud chirurgical pour le Dataset
        status: DraftStatus.PROCESSING,
        progressPercent: 10, // Petit reset visuel pour montrer que l'IA a repris
      },
    });
  }
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

    const updateData: any = {
      progressPercent: progress
    };

    const parseIfString = (val: any) => {
      if (typeof val !== 'string') return val;
      try { return JSON.parse(val); } catch { return val; }
    };

    if (syllabus) updateData.syllabus = parseIfString(syllabus);

    // 🌟 Overwrite du contenu par la version la plus fraîche
    if (content) updateData.content = [parseIfString(content)];

    if (placementBank) updateData.placementBank = parseIfString(placementBank);
    if (certificationBank) updateData.certificationBank = parseIfString(certificationBank);
    if (finalProject) updateData.finalProject = parseIfString(finalProject);

    if (aiScore !== undefined && aiScore !== null) {
      updateData.aiScore = aiScore;
    }

    // Une fois terminé, on passe en attente de review prof
    if (progress >= 100) {
      updateData.status = DraftStatus.PENDING_REVIEW;
    }

    return this.prisma.generatedDraft.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Créer un brouillon (Méthode synchrone / Direct)
   * 🌟 AJOUT : Gestion de l'initialPrompt
   */
  async createDraft(data: {
    syllabus: any;
    content: string;
    teacherId: string;
    sourceId: string;
    title?: string;
    initialPrompt?: string;
  }) {
    return this.prisma.generatedDraft.create({
      data: {
        title: data.title,
        initialPrompt: data.initialPrompt, // 🌟 Stockage pour Fine-tuning
        syllabus: typeof data.syllabus === 'string' ? JSON.parse(data.syllabus) : data.syllabus,
        content: [typeof data.content === 'string' ? JSON.parse(data.content) : data.content],
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
    return this.prisma.generatedDraft.delete({ where: { id } });
  }

  /**
   * 🚀 PUBLICATION : Transforme le Brouillon JSON en entités réelles du LMS.
   * Cette étape rend le contenu visible pour les élèves.
   */
  async publish(draftId: string) {
    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
      include: { source: true },
    });

    if (!draft) throw new Error('Brouillon introuvable');

    // On récupère la dernière version du contenu généré
    let courseData: any = {};
    const contentArray = draft.content as any[] | null;
    if (contentArray && contentArray.length > 0) {
      courseData = contentArray[contentArray.length - 1];
    }

    const modules = courseData.modules || [];
    const title = courseData.courseTitle || draft.title || draft.source?.title || 'Sans titre';

    // 1. Création du cours réel (Table Course)
    const course = await this.prisma.course.create({
      data: {
        title: title,
        description: courseData.summary || `Cours généré par IA`,
        teacherId: draft.teacherId,
        isPublished: true,
        level: CourseLevel.BEGINNER,
        placementBank: draft.placementBank ?? undefined,
        certificationBank: draft.certificationBank ?? undefined,
        finalProject: draft.finalProject ?? undefined,
      },
    });

    // 2. Itération sur les modules et création des entités
    for (const [idx, m] of modules.entries()) {
      const createdModule = await this.prisma.module.create({
        data: {
          title: m.title || `Module ${idx + 1}`,
          order: m.order || idx + 1,
          content: m.content || '',
          courseId: course.id,
        },
      });

      // Importation des Quiz (Texte)
      const exercisesText = Array.isArray(m.exercises_text) ? m.exercises_text : [];
      for (const ex of exercisesText) {
        await this.prisma.exercise.create({
          data: {
            title: ex.question ? ex.question.substring(0, 50) : 'Quiz rapide',
            instructions: JSON.stringify(ex),
            exerciseType: ExerciseType.QUIZ,
            moduleId: createdModule.id,
          },
        });
      }

      // Importation des Défis de Code (Expert Qwen)
      const exercisesCode = Array.isArray(m.exercises_code) ? m.exercises_code : [];
      for (const codeEx of exercisesCode) {
        await this.prisma.exercise.create({
          data: {
            title: codeEx.title || 'Défi de programmation',
            instructions: codeEx.instructions || '',
            solution: codeEx.solution || '',
            exerciseType: ExerciseType.CODE_CHALLENGE,
            moduleId: createdModule.id,
          },
        });
      }
    }

    // 3. Archivage du brouillon (On ne le supprime pas, on le marque APPROVED)
    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: { status: DraftStatus.APPROVED },
    });

    return { courseId: course.id, success: true };
  }
}