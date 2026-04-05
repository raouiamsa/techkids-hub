import { Controller, Post, Get, Body, Param, UseGuards, Logger, Inject, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole, SourceType } from '@prisma/client';
import { EDU_PATTERNS } from '@org/shared-types';

@ApiTags('AI - Course Generation')
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);
  private readonly AI_BRAIN_URL = process.env.AI_BRAIN_URL || 'http://localhost:8000';

  constructor(
    private readonly httpService: HttpService,
    @Inject('EDU_SERVICE') private readonly eduClient: ClientProxy
  ) {}

  @Post('ingest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ingérer un document PDF pour le RAG' })
  async ingest(@Body() data: { file_path: string; course_id: string }) {
    this.logger.log(`Ingestion AI demandée pour : ${data.course_id}`);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_BRAIN_URL}/ingest`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur Ingestion AI : ${error.message}`);
      throw error;
    }
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer ou rectifier un cours via IA' })
  async generate(
    @Req() req: any,
    @Body() data: { 
      input_request: string; 
      course_id: string; 
      age_group: number;
      teacher_feedback?: string;
    }
  ) {
    this.logger.log(`Génération AI demandée pour : ${data.course_id}`);
    try {
      // 1. Appel au cerveau IA (Python)
      const response = await firstValueFrom(
        this.httpService.post(`${this.AI_BRAIN_URL}/generate`, data)
      );

      const aiResult = response.data;

      // 2. Persistance : On sauvegarde et on récupère le draftId
      const draft = await firstValueFrom(
        this.eduClient.send(EDU_PATTERNS.DRAFTS_CREATE, {
          syllabus: aiResult.syllabus,
          content: aiResult.content,
          teacherId: req.user.id,
          source: {
            title: data.input_request,
            type: SourceType.PDF,
            url: data.course_id,
          }
        })
      );

      // 3. On retourne le résultat IA + le draftId pour le bouton "Publier"
      return { ...aiResult, draftId: draft?.id };
    } catch (error: any) {
      this.logger.error(`Erreur Génération AI : ${error.message}`);
      throw error;
    }
  }


  @Get('drafts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les brouillons générés par le professeur' })
  async getMyDrafts(@Req() req: any) {
    return this.eduClient.send(EDU_PATTERNS.DRAFTS_LIST, { teacherId: req.user.id });
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
}

