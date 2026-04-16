import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { DraftStatus, SourceType } from '@prisma/client';

@Injectable()
export class DraftsService {
  private readonly logger = new Logger(DraftsService.name);

  constructor(private prisma: PrismaService) { }

  //Créer ou mettre à jour une source de contenu (PDF, URL)
  async upsertSource(data: { title: string; type: SourceType; url: string; courseId?: string }) {
    this.logger.log(`Upsert source: ${data.title}`);
    return this.prisma.contentSource.upsert({
      where: { url: data.url },
      update: { title: data.title },
      create: { ...data },
    });
  }

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

  async updateDraftProgress(id: string, progress: number, syllabus?: any, content?: string) {
    this.logger.log(`Mise à jour de la progression du brouillon ${id} : ${progress}%`);
    const updateData: any = { progressPercent: progress };

    if (progress >= 100) {
      updateData.status = DraftStatus.PENDING_REVIEW;
      if (syllabus) updateData.syllabus = syllabus;
      if (content) updateData.content = content;
    }

    return this.prisma.generatedDraft.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Créer un nouveau brouillon généré par l'IA (Ancienne méthode synchrone)
   */
  async createDraft(data: {
    syllabus: any;
    content: string;
    teacherId: string;
    sourceId: string;
  }) {
    this.logger.log(`Création d'un nouveau brouillon pour le prof: ${data.teacherId}`);
    try {
      const result = await this.prisma.generatedDraft.create({
        data: {
          syllabus: data.syllabus,
          content: data.content,
          teacherId: data.teacherId,
          sourceId: data.sourceId,
          status: DraftStatus.PENDING_REVIEW,
        },
      });
      return result;
    } catch (error: any) {
      this.logger.error(" ERREUR FATALE PRISMA DANS createDraft ");
      console.error("Détails de l'erreur Prisma:", error);
      throw error;
    }
  }

  //Lister les brouillons d'un professeur
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

  //Approuver ou rejeter un brouillon
  async updateStatus(id: string, status: DraftStatus) {
    return this.prisma.generatedDraft.update({
      where: { id },
      data: { status },
    });
  }

  // ── Publication Full-JSON ─────────────────────────────────────────────────
  // Désérialise le JSON du Rédacteur (Gemini + Qwen) et crée dans PostgreSQL :
  // 1 Course  →  N Module  →  M Exercise (TEXT, QUIZ, CODE)
  async publish(draftId: string) {
    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
      include: { source: true },
    });

    if (!draft) throw new Error('Brouillon introuvable');
    this.logger.log(` Publication Full-JSON du brouillon ${draftId} vers le LMS...`);
    // Le champ "content" stocke le JSON Full-Format généré par writer.py
    let courseData: any = {};
    try {
      const contentStr = typeof draft.content === 'string'
        ? draft.content
        : JSON.stringify(draft.content);
      courseData = JSON.parse(contentStr);
    } catch (e) {
      this.logger.warn(' Impossible de parser le JSON. Mode fallback activé.');
      courseData = { courseTitle: draft.source?.title || 'Cours IA', modules: [] };
    }

    const modules: any[] = courseData.modules || [];
    const courseTitle = courseData.courseTitle
      || draft.source?.title?.replace('.pdf', '')
      || 'Cours IA';
    const courseDesc = (courseData.objectives || []).join('. ')
      || `Cours IA (${courseData.level || 'Tous niveaux'})`;

    // ── ÉTAPE 2 : Créer le Course parent ─────────────────────────────────────
    const course = await this.prisma.course.create({
      data: {
        title: courseTitle,
        description: courseDesc,
        teacherId: draft.teacherId,
        isPublished: true,
      },
    });
    this.logger.log(`Course créé : "${courseTitle}" (ID: ${course.id})`);

    // ── ÉTAPE 3 : Créer chaque Module + ses Exercises ────────────────────────
    for (const [index, moduleData] of modules.entries()) {

      // 3a. Module physique en base de données
      const createdModule = await this.prisma.module.create({
        data: {
          title: moduleData.title || `Module ${index + 1}`,
          order: moduleData.order || index + 1,
          content: moduleData.content || '',
          courseId: course.id,
        },
      });
      this.logger.log(`   Module ${index + 1} créé : "${moduleData.title}"`);


      const exText: any[] = moduleData.exercises_text || [];
      for (const ex of exText) {

        const exerciseType = ex.type === 'CODE' ? 'CODE_CHALLENGE' : 'QUIZ';
        await this.prisma.exercise.create({
          data: {
            title: ex.title || 'Exercice',
            instructions: JSON.stringify(ex.questions || {}), // On sérialise les questions en String
            exerciseType: exerciseType as any,
            solution: null,
            moduleId: createdModule.id,
          },
        });
      }

      // 3c. Exercices CODE → CODE_CHALLENGE (via Qwen 2.5 Coder)
      const exCode: any[] = moduleData.exercises_code || [];
      for (const codeEx of exCode) {
        await this.prisma.exercise.create({
          data: {
            title: codeEx.title || 'Exercice de code',
            instructions: codeEx.instructions || '',  // Instructions textuelles
            exerciseType: 'CODE_CHALLENGE',
            solution: codeEx.solution || null,        // La solution complète en String
            moduleId: createdModule.id,
          },
        });
      }

      const totalEx = exText.length + exCode.length;
      if (totalEx > 0) {
        this.logger.log(`${totalEx} exercice(s) créé(s) pour le module ${index + 1}`);
      }
    }

    // ── ÉTAPE 4 : Archiver le brouillon comme APPROVED ───────────────────────
    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: { status: DraftStatus.APPROVED },
    });

    this.logger.log(`Cours "${courseTitle}" publié avec ${modules.length} module(s) !`);
    return { course, modulesCount: modules.length };
  }

  async deleteDraft(id: string) {
    this.logger.log(`Suppression du brouillon ${id}`);
    return this.prisma.generatedDraft.delete({
      where: { id },
    });
  }
}
