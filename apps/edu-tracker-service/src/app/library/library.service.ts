import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';

@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(private prisma: PrismaService) { }

  async createContentSource(data: { title: string; url: string; type: any; teacherId?: string }) {
    this.logger.log(`Création d'une nouvelle source : ${data.title}`);

    // Vérifier si cette URL/chemin exact a déjà été indexé
    if (data.url && data.url !== 'unknown') {
      const existing = await this.prisma.contentSource.findUnique({
        where: { url: data.url }
      });
      if (existing) {
        this.logger.log(`Source déjà existante pour l'URL: ${data.url}`);
        return existing;
      }
    }

    try {
      return await this.prisma.contentSource.create({
        data: {
          title: data.title,
          url: data.url,
          type: data.type,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        this.logger.log(`Doublon détecté à la création (concurrence) pour l'URL: ${data.url}`);
        return this.prisma.contentSource.findUnique({ where: { url: data.url } });
      }
      throw error;
    }
  }

  async getSources() {
    return this.prisma.contentSource.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSource(id: string) {
    const source = await this.prisma.contentSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Source introuvable');

    this.logger.log(`Suppression de la source ID: ${id}`);

    // 1. Détacher les drafts liés (Draft "Autonome" — le contenu généré reste intact)
    // sourceId devient null → Draft gardée mais marquable comme "orpheline" côté Front
    await this.prisma.generatedDraft.updateMany({
      where: { sourceId: id },
      data: { sourceId: null as any }
    });

    // 2. Puis supprimer la source elle-même
    return this.prisma.contentSource.delete({ where: { id } });
  }

  async updateIndexingStatus(id: string, status: 'INDEXING' | 'READY' | 'ERROR') {
    this.logger.log(`Mise à jour statut source ${id} → ${status}`);
    return this.prisma.contentSource.update({
      where: { id },
      data: { indexingStatus: status }
    });
  }
}
