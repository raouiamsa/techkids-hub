import {
  Controller, Post, Get, Delete, Patch, Body, Param,
  UseGuards, Logger, Inject, Req, Res, UseInterceptors,
  UploadedFile, HttpException, HttpStatus, Headers, UnauthorizedException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole, SourceType } from '@prisma/client';
import { EDU_PATTERNS } from '@org/shared-types';
import { EVENTS } from '@org/messaging';
import { AiGateway } from './ai.gateway';
import { IsString, IsArray, IsNumber, IsOptional, IsBoolean, IsObject } from 'class-validator';

// ── 1. DATA TRANSFER OBJECTS (DTOs) ─────────────────────────────────────────

class GenerateCourseDto {
  @ApiProperty() @IsString() input_request!: string;
  @ApiProperty() @IsArray() @IsString({ each: true }) course_ids!: string[];
  @ApiProperty({ default: 12, required: false }) @IsOptional() @IsNumber() age_group?: number;
  @ApiProperty({ default: 'BEGINNER', required: false }) @IsOptional() @IsString() level?: string;
  @ApiProperty({ default: false, required: false }) @IsOptional() @IsBoolean() include_code_exercises?: boolean;
  @ApiProperty({ default: 'Python', required: false }) @IsOptional() @IsString() programming_language?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() teacher_notes?: string;
}

class RectifyDraftDto extends GenerateCourseDto {
  @ApiProperty() @IsString() feedback!: string; // نقد عام
  // 🌟 نقد لكل موديول للـ Fine-tuning (Object: { "Module Title": "Feedback" })
  @ApiProperty({ required: false }) @IsOptional() @IsObject() module_feedbacks?: Record<string, string>;
  @ApiProperty({ required: false }) @IsOptional() @IsString() existing_content?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() existing_syllabus?: string;
}

class UpdateProgressDto {
  @ApiProperty() @IsNumber() progressPercent!: number;
  @ApiProperty({ required: false }) @IsOptional() syllabus?: any;
  @ApiProperty({ required: false }) @IsOptional() @IsString() content?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() aiScore?: number;
  @ApiProperty({ required: false }) @IsOptional() finalProject?: any;
  @ApiProperty({ required: false }) @IsOptional() placementBank?: any;
  @ApiProperty({ required: false }) @IsOptional() certificationBank?: any;
}

// ── 2. CONTROLLER ────────────────────────────────────────────────────────────

@ApiTags('AI - Génération de Cours')
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);
  private readonly AI_BRAIN_URL = process.env.AI_BRAIN_URL || 'http://localhost:8000';
  private readonly INTERNAL_AI_SECRET = process.env.INTERNAL_AI_SECRET || 'votre-secret-pfe-2026';
  private readonly UPLOADS_DIR = path.resolve('./uploads');

  constructor(
    private readonly httpService: HttpService,
    @Inject('EDU_SERVICE') private readonly eduClient: ClientProxy,
    @Inject('RABBITMQ_CLIENT') private readonly rabbitClient: ClientProxy,
    private readonly aiGateway: AiGateway,
  ) { }

  // 📂 INGESTION : Upload d'une nouvelle source (PDF, YouTube, Webpage)
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
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 }, // Limite de 15 Mo par fichier
  }))
  @ApiOperation({ summary: 'Uploader une source et lancer l\'indexation vectorielle' })
  async uploadSource(
    @Req() req: any,
    @Body() body: { type: string; url?: string; title?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.logger.log(`Ingestion d'une nouvelle source : ${body.type}`);

    const sourceUrl = file ? path.resolve(file.path) : (body.url || 'unknown');
    const title = file ? file.originalname : (body.title || body.url || 'Lien externe');
    const normalizedType = (body.type === 'VIDEO' ? 'YOUTUBE' : body.type) as SourceType;

    // 1. Enregistrement initial en base de données
    const savedSource = await firstValueFrom(
      this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_CREATE, {
        title,
        url: sourceUrl,
        type: normalizedType,
        teacherId: req.user.userId,
      }),
    );

    // 2. Déclenchement de l'indexation via RabbitMQ
    if (savedSource.indexingStatus !== 'READY') {
      this.rabbitClient.emit(EVENTS.SOURCE_INDEXING_REQUESTED, {
        sourceId: savedSource.id,
        type: body.type,
        filePath: file ? sourceUrl : null,
        url: body.url || null,
      }).subscribe();
    }

    return {
      status: savedSource.indexingStatus === 'READY' ? 'done' : 'indexing',
      sourceId: savedSource.id,
      sourceUrl,
    };
  }

  // 🧠 GÉNÉRATION : Pipeline LangGraph complet (Sophie Chen)
  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lancer la génération complète d\'un cours par Sophie Chen' })
  async generate(@Req() req: any, @Body() data: GenerateCourseDto) {
    this.logger.log(`Génération demandée pour le sujet : ${data.input_request}`);
    try {
      const primarySourceId = data.course_ids?.length > 0 ? data.course_ids[0] : null;

      // 🌟 CONSTRUCTION DU PROMPT INITIAL (Bundling pour le Fine-tuning)
      // On capture tout le contexte pour que Sophie Chen apprenne la relation Input -> Output
      const fullInitialPrompt = `
        Subject: ${data.input_request}
        Target Age: ${data.age_group} years old
        Knowledge Level: ${data.level}
        Specific Teacher Notes: ${data.teacher_notes || 'None'}
        Selected Technology: ${data.programming_language || 'Python'}
      `.trim();

      // 1. Initialisation du draft avec le prompt complet dans la Database
      const draft = await firstValueFrom(
        this.eduClient.send('DRAFTS_CREATE_PROCESSING', {
          teacherId: req.user.userId,
          title: data.input_request || 'Nouveau Cours IA',
          initialPrompt: fullInitialPrompt, // 🚨 Indispensable pour construire la Dataset plus tard
          sourceId: primarySourceId,
        }),
      );

      // 2. Appel asynchrone au cerveau Python (Sophie Chen)
      this.httpService.post(`${this.AI_BRAIN_URL}/generate`, {
        ...data,
        draft_id: draft.id,
        initial_prompt: fullInitialPrompt, // Passé aux agents pour contexte RAG
        internal_secret: this.INTERNAL_AI_SECRET,
      }).subscribe({
        next: (response) => {
          // Mise à jour finale automatique une fois que Python a terminé
          this.eduClient.send('DRAFTS_UPDATE_PROGRESS', {
            id: draft.id,
            progressPercent: 100,
            ...response.data,
          }).subscribe();
        },
        error: (err) => this.logger.error(`Échec du pipeline Python : ${err.message}`),
      });

      return { status: 'processing', draftId: draft.id, message: 'Sophie Chen commence la rédaction...' };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('generate-syllabus')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer uniquement le syllabus pour validation préalable' })
  async generateSyllabus(@Req() req: any, @Body() data: GenerateCourseDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_BRAIN_URL}/generate-syllabus`, data),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur Syllabus : ${error.message}`);
      throw new HttpException('Échec de la génération du plan de cours', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 🔄 RECTIFICATION : Feedback HitL (Surgical Mode)
  @Post('rectify/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Correction chirurgicale basée sur le feedback professeur' })
  async rectifyDraft(@Param('id') id: string, @Body() data: RectifyDraftDto) {
    this.logger.log(`Rectification demandée pour le draft ${id}`);

    // 1. Sauvegarde des feedbacks (Général + Par Module) en base de données
    await firstValueFrom(this.eduClient.send('DRAFTS_RECTIFY', {
      draftId: id,
      feedback: data.feedback,
      moduleFeedbacks: data.module_feedbacks || {}, // 🌟 Stockage pour le Fine-tuning
    }));

    // 2. Relance de Sophie Chen avec le mode chirurgical (Python identifiera les failing_titles)
    this.httpService.post(`${this.AI_BRAIN_URL}/generate`, {
      ...data,
      draft_id: id,
      teacher_feedback: data.feedback,
      module_feedbacks: data.module_feedbacks, // Sophie Chen reçoit les critiques ciblées
      internal_secret: this.INTERNAL_AI_SECRET,
    }).subscribe({
      next: (response) => {
        this.eduClient.send('DRAFTS_UPDATE_PROGRESS', {
          id: id,
          progressPercent: 100,
          ...response.data,
        }).subscribe();
      },
      error: (err) => this.logger.error(`Erreur lors de la rectification : ${err.message}`),
    });

    return { status: 'processing', draftId: id, message: 'Sophie Chen retravaille les modules ciblés...' };
  }

  @Post('generate-practice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer un module de remédiation personnalisé' })
  async generatePractice(@Body() data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_BRAIN_URL}/generate-practice`, data),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur Practice More : ${error.message}`);
      throw new HttpException('Service de remédiation temporairement indisponible', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 📡 TÉLÉMÉTRIE : Mise à jour sécurisée par les agents Python (Internal Only)
  @Patch('internal/drafts/:id/progress')
  @ApiOperation({ summary: 'Point d\'entrée sécurisé pour les agents Python (Interne)' })
  async updateInternalProgress(
    @Param('id') draftId: string,
    @Body() data: UpdateProgressDto,
    @Headers('x-ai-secret') secret: string,
  ) {
    // 🔒 SÉCURITÉ : Vérification du secret partagé
    if (secret !== this.INTERNAL_AI_SECRET) {
      this.logger.warn(`Accès non autorisé à la télémétrie (draft: ${draftId})`);
      throw new UnauthorizedException('Clé secrète invalide ou absente');
    }
    this.logger.log(`Progression validée : Draft ${draftId} ➔ ${data.progressPercent}%`);

    // Notification temps réel via WebSocket (Gateway -> Frontend)
    this.aiGateway.broadcastDraftUpdate(draftId, data.progressPercent);

    // Persistance dans le microservice Edu-Tracker
    return this.eduClient.send('DRAFTS_UPDATE_PROGRESS', { id: draftId, ...data });
  }

  // 📋 GESTION DES BROUILLONS (CRUD)
  @Get('drafts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  async getMyDrafts(@Req() req: any) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_LIST, { teacherId: req.user.userId });
  }

  @Get('drafts/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  async getDraftStatus(@Param('id') draftId: string) {
    return this.eduClient.send('DRAFTS_GET', { draftId });
  }

  @Post('publish/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  async publishDraft(@Param('id') draftId: string) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_PUBLISH, { draftId });
  }

  @Post('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  async rejectDraft(@Param('id') draftId: string) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_DELETE, { draftId });
  }

  // 📚 GESTION DE LA BIBLIOTHÈQUE
  @Get('content-sources')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  async getMySources(@Req() req: any) {
    return this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_LIST, { teacherId: req.user.userId });
  }

  @Delete('content-sources/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  async deleteSource(@Param('id') id: string) {
    return this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_DELETE, { sourceId: id });
  }

  @Patch('content-sources/:id/status')
  async updateSourceStatus(
    @Param('id') sourceId: string,
    @Body() data: { status: 'READY' | 'ERROR' },
  ) {
    this.logger.log(`Indexation Source ${sourceId} terminée : ${data.status}`);
    this.aiGateway.broadcastSourceUpdate(sourceId, data.status);
    return this.eduClient.send(EDU_PATTERNS.CONTENT_SOURCES_UPDATE_STATUS, {
      sourceId,
      status: data.status,
    });
  }

  // 📄 VIEWER PDF SÉCURISÉ
  @Get('files/:filename')
  @ApiOperation({ summary: 'Servir un fichier PDF pour le viewer intégré' })
  async serveFile(@Param('filename') filename: string, @Res() res: any) {
    const filePath = path.resolve(this.UPLOADS_DIR, filename);

    // Protection contre le Directory Traversal
    if (!filePath.startsWith(this.UPLOADS_DIR + path.sep)) {
      throw new HttpException('Chemin de fichier invalide', HttpStatus.BAD_REQUEST);
    }

    if (!fs.existsSync(filePath)) {
      throw new HttpException('Fichier introuvable sur le serveur', HttpStatus.NOT_FOUND);
    }

    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(filePath).pipe(res);
  }
}