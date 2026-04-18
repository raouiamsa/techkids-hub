import {
  Controller, Post, Get, Delete, Patch, Body, Param,
  UseGuards, Logger, Inject, Req, Res, UseInterceptors,
  UploadedFile, HttpException, HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole, SourceType } from '@prisma/client';
import { EDU_PATTERNS } from '@org/shared-types';
import { EVENTS } from '@org/messaging';

@ApiTags('AI - Course Generation')
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);
  private readonly AI_BRAIN_URL = process.env.AI_BRAIN_URL || 'http://localhost:8000';

  constructor(
    private readonly httpService: HttpService,
    @Inject('EDU_SERVICE') private readonly eduClient: ClientProxy,
    @Inject('RABBITMQ_CLIENT') private readonly rabbitClient: ClientProxy
  ) { }

  /**
   * 📂 Ingestion : Uploadi source jdida (PDF, YouTube, Webpage)
   * Envoie un ordre de vectorisation à RabbitMQ pour le cerveau Python.
   */
  @Post('content-sources')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    })
  }))
  @ApiOperation({ summary: 'Uploader une nouvelle source et lancer l\'indexation' })
  async uploadSource(
    @Req() req: any,
    @Body() body: { type: SourceType; url?: string; title?: string },
    @UploadedFile() file?: Express.Multer.File
  ) {
    this.logger.log(`Nouvelle source reçue : ${body.type}`);

    const sourceUrl = file ? path.resolve(file.path) : (body.url || 'unknown');
    const title = file ? file.originalname : (body.title || 'Lien externe');

    // Sauvegarde en BDD immédiate via le microservice Edu
    const savedSource = await firstValueFrom(
      this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_CREATE, {
        title,
        url: sourceUrl,
        type: body.type,
        teacherId: req.user.userId,
      })
    );

    // Envoi de l'ordre RabbitMQ si la source n'est pas déjà prête
    if (savedSource.indexingStatus !== 'READY') {
      this.rabbitClient.emit(EVENTS.SOURCE_INDEXING_REQUESTED, {
        sourceId: savedSource.id,
        type: body.type,
        filePath: file ? sourceUrl : null,
        url: body.url || null,
        courseId: sourceUrl,
      }).subscribe();
    }

    return {
      status: savedSource.indexingStatus === 'READY' ? 'done' : 'indexing',
      message: savedSource.indexingStatus === 'READY' ? 'Source existante.' : 'Vectorisation en cours...',
      sourceId: savedSource.id,
      sourceUrl,
    };
  }

  /**
   * 📄 Viewer : Servir les fichiers PDF statiques pour le Frontend
   */
  @Get('files/:filename')
  @ApiOperation({ summary: 'Visualiser un fichier PDF de la bibliothèque' })
  async serveFile(@Param('filename') filename: string, @Res() res: any) {
    const filePath = path.resolve('./uploads', filename);
    if (!fs.existsSync(filePath)) {
      throw new HttpException('Fichier introuvable', HttpStatus.NOT_FOUND);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  /**
   * 🧠 Génération AI : Lancer le pipeline LangGraph (Asynchrone)
   * Crée un brouillon et délègue la rédaction riche à Python.
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer un cours riche (Modules + Certif + Projet)' })
  async generate(@Req() req: any, @Body() data: any) {
    this.logger.log(`Génération AI demandée pour le prof : ${req.user.userId}`);
    try {
      // 1. Création d'un brouillon initial (Statut PROCESSING)
      const draft = await firstValueFrom(
        this.eduClient.send('DRAFTS_CREATE_PROCESSING', {
          teacherId: req.user.userId,
          source: {
            title: data.input_request || "Sujet AI",
            type: SourceType.PDF,
            url: data.course_ids && data.course_ids.length > 0 ? data.course_ids[0] : "mix_sources",
          }
        })
      );

      const payload = { ...data, draft_id: draft.id };

      // 2. Appel au Cerveau IA en tâche de fond (Fire and Forget avec callback)
      this.httpService.post(`${this.AI_BRAIN_URL}/generate`, payload).subscribe({
        next: (response) => {
          const aiResult = response.data;
          // Finalisation (100%) avec les nouveaux champs : certif et projet final
          this.eduClient.send('DRAFTS_UPDATE_PROGRESS', {
            id: draft.id,
            progressPercent: 100,
            syllabus: aiResult.syllabus,
            content: aiResult.content,
            placementBank: aiResult.placement_bank,
            certificationBank: aiResult.certification_bank, // 🌟 Nouveau
            finalProject: aiResult.final_project           // 🌟 Nouveau
          }).subscribe();
        },
        error: (err) => this.logger.error(`Erreur Python Background : ${err.message}`)
      });

      return { status: "processing", draftId: draft.id, message: "Génération en cours..." };
    } catch (error: any) {
      this.logger.error(`Erreur Lancement AI : ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 📡 Webhook : Python met à jour la progression en temps réel (30%, 60%, 85%)
   */
  @Patch('internal/drafts/:id/progress')
  @ApiOperation({ summary: 'Webhook interne pour la télémétrie Python' })
  async updateInternalProgress(
    @Param('id') draftId: string,
    @Body() data: {
      progressPercent: number;
      syllabus?: any;
      content?: string;
      placementBank?: any;
      certificationBank?: any;
      finalProject?: any
    }
  ) {
    this.logger.log(`Télémétrie : Draft ${draftId} ➔ ${data.progressPercent}%`);
    return this.eduClient.send('DRAFTS_UPDATE_PROGRESS', { id: draftId, ...data });
  }

  /**
   * 📋 Brouillons : Liste des drafts du professeur
   */
  @Get('drafts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les brouillons du professeur' })
  async getMyDrafts(@Req() req: any) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_LIST, { teacherId: req.user.userId });
  }

  /**
   * 🔄 Polling : Récupérer le statut et le contenu d'un draft spécifique
   */
  @Get('drafts/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vérifier l\'avancement d\'un brouillon' })
  async getDraftStatus(@Param('id') draftId: string) {
    return this.eduClient.send('DRAFTS_GET', { draftId });
  }

  /**
   * ✅ Publication : Transformer un brouillon validé en un vrai cours
   */
  @Post('publish/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approuver et publier un brouillon' })
  async publishDraft(@Param('id') draftId: string) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_PUBLISH, { draftId });
  }

  /**
   * 🗑️ Suppression : Rejeter un brouillon
   */
  @Post('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un brouillon' })
  async rejectDraft(@Param('id') draftId: string) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_DELETE, { draftId });
  }

  /**
   * ⚡ Practice More : Génération d'exercices à la volée (MoA rapide)
   */
  @Post('generate-practice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer un exercice d\'entraînement personnalisé' })
  async generatePractice(@Body() data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_BRAIN_URL}/generate-practice`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur Practice : ${error.message}`);
      throw new HttpException('Erreur lors de la génération Practice', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 📚 Bibliothèque : Gestion des sources
   */
  @Get('content-sources')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les sources de la bibliothèque' })
  async getMySources(@Req() req: any) {
    return firstValueFrom(
      this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_LIST, { teacherId: req.user.userId })
    );
  }

  @Delete('content-sources/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une source' })
  async deleteSource(@Param('id') id: string) {
    return firstValueFrom(
      this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_DELETE, { sourceId: id })
    );
  }

  /**
   * 🔄 Webhook Indexation : Python notifie NestJS du statut READY/ERROR
   */
  @Patch('content-sources/:id/status')
  @ApiOperation({ summary: 'Mise à jour du statut d\'indexation (Interne)' })
  async updateSourceStatus(
    @Param('id') sourceId: string,
    @Body() data: { status: 'READY' | 'ERROR' }
  ) {
    this.logger.log(`Indexation source ${sourceId} ➔ ${data.status}`);
    return this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_UPDATE_STATUS, {
      sourceId,
      status: data.status,
    });
  }
}