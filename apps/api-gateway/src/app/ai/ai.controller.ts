import { Controller, Post, Get, Delete, Patch, Body, Param, UseGuards, Logger, Inject, Req, Res, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Uploader une nouvelle source (PDF, YOUTUBE, WEBPAGE)' })
  async uploadSource(
    @Req() req: any,
    @Body() body: { type: SourceType; url?: string; title?: string },
    @UploadedFile() file?: Express.Multer.File
  ) {
    this.logger.log(`Nouvelle source reçue : ${body.type}`);

    // 1. Construction de l'URL/chemin de la source
    const sourceUrl = file ? path.resolve(file.path) : (body.url || 'unknown');
    const title = file ? file.originalname : (body.title || 'Lien externe');

    // 2. Sauvegarde en BDD immédiate (statut INDEXING par défaut)
    const savedSource = await firstValueFrom(
      this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_CREATE, {
        title,
        url: sourceUrl,
        type: body.type,
        teacherId: req.user.userId,
      })
    );

    if (savedSource.indexingStatus !== 'READY') {
      this.logger.log(`Envoi de l'ordre de vectorisation à RabbitMQ pour ${savedSource.id}...`);
      this.rabbitClient.emit(EVENTS.SOURCE_INDEXING_REQUESTED, {
        sourceId: savedSource.id,
        type: body.type,
        filePath: file ? sourceUrl : null,
        url: body.url || null,
        courseId: sourceUrl,
      }).subscribe({
        error: (err) => this.logger.error(`Erreur d'envoi RabbitMQ: ${err.message || JSON.stringify(err)}`),
        complete: () => this.logger.log(`Ordre RabbitMQ envoyé avec succès !`)
      });
    }

    // 4. Réponse immédiate
    return {
      status: savedSource.indexingStatus === 'READY' ? 'done' : 'indexing',
      message: savedSource.indexingStatus === 'READY' ? 'Source existante, déjà vectorisée.' : 'Source ajoutée. Vectorisation en arrière-plan...',
      sourceId: savedSource.id,
      sourceUrl,
    };
  }

  // ─── Visualiser un PDF stocké sur le serveur ──────────────────────────────
  @Get('files/:filename')
  @ApiOperation({ summary: 'Visualiser un fichier PDF de la bibliothèque (accès public par URL directe)' })
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

  // ─── Webhook interne : Python notifie la fin de la vectorisation ──────────
  @Patch('content-sources/:id/status')
  @ApiOperation({ summary: 'Webhook interne Python → mise à jour du statut d\'indexation' })
  async updateSourceStatus(
    @Param('id') sourceId: string,
    @Body() data: { status: 'READY' | 'ERROR' }
  ) {
    this.logger.log(`Webhook Indexation: source ${sourceId} → ${data.status}`);
    return this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_UPDATE_STATUS, {
      sourceId,
      status: data.status,
    });
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer asynchronement un cours via IA' })
  async generate(
    @Req() req: any,
    @Body() data: {
      input_request: string;
      course_ids: string[]; // URLs/IDs des sources sélectionnées
      age_group: number;
      level?: string;
      include_code_exercises?: boolean; // Décision du prof via le Toggle UI
      teacher_feedback?: string;
    }
  ) {
    this.logger.log(`Génération AI Asynchrone demandée pour : ${data.course_ids.length} sources`);
    try {
      // 1. Création d'un brouillon PROCESSING (À 0%)
      const draft = await firstValueFrom(
        this.eduClient.send('DRAFTS_CREATE_PROCESSING', {
          teacherId: req.user.userId,
          source: {
            title: data.input_request || "Sujet AI",
            type: SourceType.PDF, // TODO: récuperer dynamiquement, mais pas bloquant pour le moment
            url: data.course_ids && data.course_ids.length > 0 ? data.course_ids[0] : "mix_sources",
          }
        })
      );

      const payload = { ...data, draft_id: draft.id };

      // 2. Appel "En arrière-plan" au Cerveau IA
      this.httpService.post(`${this.AI_BRAIN_URL}/generate`, payload).subscribe({
        next: (response) => {
          const aiResult = response.data;
          this.logger.log(`Génération Python Terminée avec succès pour le draft ${draft.id}`);
          // Force le 100% avec les contenus reçus en cas de besoin
          this.eduClient.send('DRAFTS_UPDATE_PROGRESS', {
            id: draft.id,
            progressPercent: 100,
            syllabus: aiResult.syllabus || "Vide",
            content: aiResult.content || "Vide",
            placementBank: aiResult.placement_bank || null
          }).subscribe();
        },
        error: (err) => {
          this.logger.error(`Erreur Python en tâche de fond : ${err.message}`);
        }
      });

      // 3. Réponse instantanée au Front-End
      return { status: "processing", draftId: draft.id, message: "Génération en cours..." };
    } catch (error: any) {
      this.logger.error(`Erreur Lancement Génération AI : ${error.message}`);
      throw error;
    }
  }

  @Patch('internal/drafts/:id/progress')
  @ApiOperation({ summary: 'Webhook interne pour Python (mise à jour progression)' })
  async updateInternalProgress(
    @Param('id') draftId: string,
    @Body() data: { progressPercent: number; syllabus?: any; content?: string; placementBank?: any }
  ) {
    this.logger.log(`Webhook Télémétrie reçu: Draft ${draftId} ➔ ${data.progressPercent}%`);
    return this.eduClient.send('DRAFTS_UPDATE_PROGRESS', { id: draftId, ...data });
  }


  @Get('drafts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les brouillons générés par le professeur' })
  async getMyDrafts(@Req() req: any) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_LIST, { teacherId: req.user.id });
  }

  @Get('drafts/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vérifier la progression dun brouillon (Polling)' })
  async getDraftStatus(@Param('id') draftId: string) {
    return this.eduClient.send('DRAFTS_GET', { draftId });
  }

  @Post('publish/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publier un brouillon pour en faire un vrai cours' })
  async publishDraft(@Param('id') draftId: string) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_PUBLISH, { draftId });
  }

  @Post('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rejeter/Supprimer un brouillon' })
  async rejectDraft(@Param('id') draftId: string) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_DELETE, { draftId });
  }

  @Post('generate-practice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer un exercice interactif à la volée (MoA Asynchrone rapide)' })
  async generatePractice(
    @Body() data: {
      concept: string;
      age_group: number;
      level?: string;
      student_mistake?: string;
      is_success?: boolean;
    }
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_BRAIN_URL}/generate-practice`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur Génération Practice: ${error.message}`);
      throw new HttpException('Erreur lors de la génération IA', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── Bibliothèque de Documents (CRUD) ──────────────────────────────────────────

  @Get('content-sources')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les sources de la bibliothèque du professeur' })
  async getMySources(@Req() req: any) {
    return firstValueFrom(
      this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_LIST, { teacherId: req.user.userId })
    );
  }

  @Delete('content-sources/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une source de la bibliothèque (Base de données uniquement)' })
  async deleteSource(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_DELETE, { sourceId: id })
      );
    } catch (error: any) {
      this.logger.error(`Erreur suppression source ${id}: ${error.message}`);
      throw new HttpException('Impossible de supprimer cette source', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

