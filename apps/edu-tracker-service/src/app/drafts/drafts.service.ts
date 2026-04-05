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

  /**
   * Créer un nouveau brouillon généré par l'IA
   */
  async createDraft(data: {
    syllabus: any; // Type Json de Prisma
    content: string;
    teacherId: string;
    sourceId: string;
  }) {
    this.logger.log(`Création d'un nouveau brouillon pour le prof: ${data.teacherId}`);
    return this.prisma.generatedDraft.create({
      data: {
        syllabus: data.syllabus,
        content: data.content,
        teacherId: data.teacherId,
        sourceId: data.sourceId,
        status: DraftStatus.PENDING_REVIEW,
      },
    });
  }

  //Lister les brouillons d'un professeur
  async getTeacherDrafts(teacherId: string) {
    return this.prisma.generatedDraft.findMany({
      where: { teacherId },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  //Approuver ou rejeter un brouillon

  async updateStatus(id: string, status: DraftStatus) {
    return this.prisma.generatedDraft.update({
      where: { id },
      data: { status },
    });
  }

  //publier un brouillon 
  async publish(draftId: string) {
    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
      include: { source: true },
    });

    if (!draft) throw new Error('Brouillon introuvable');

    this.logger.log(`Publication du brouillon ${draftId} vers le LMS...`);

    // 1. On crée le cours final
    const course = await this.prisma.course.create({
      data: {
        title: draft.source.title.replace('.pdf', ''),
        description: `Cours généré par IA à partir de : ${draft.source.title}`,
        teacherId: draft.teacherId,
        isPublished: true,
      },
    });

    // 2. On transforme le Syllabus (JSON) en modules réels
    // On suppose que le syllabus est un tableau de modules
    const syllabus = (draft.syllabus as any[]) || [];

    for (const [index, moduleData] of syllabus.entries()) {
      await this.prisma.module.create({
        data: {
          title: moduleData.title || `Module ${index + 1}`,
          order: index + 1,
          content: moduleData.content || draft.content,
          courseId: course.id,
        },
      });
    }

    // 3. On marque le brouillon comme approuvé/publié
    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: { status: DraftStatus.APPROVED },
    });

    return course;
  }

  async deleteDraft(id: string) {
    this.logger.log(`Suppression du brouillon ${id}`);
    return this.prisma.generatedDraft.delete({
      where: { id },
    });
  }
}
