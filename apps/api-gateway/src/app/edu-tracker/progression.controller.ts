import { Controller, Post, Get, Body, Param, Inject, UseGuards, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { EDU_PATTERNS, SubmitExerciseDto, UpdateProgressionDto } from '@org/shared-types';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole } from '@prisma/client';
import { throwRpcError } from '../shared/rpc-error.helper';

@ApiTags('Edu-Tracker - Progression')
@Controller('progression')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgressionController {
  constructor(@Inject('EDU_SERVICE') private readonly eduClient: ClientProxy) {}

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Voir ma progression (STUDENT)' })
  async getMyProgress(@Req() req: any) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.MY_PROGRESS, req.user.userId));
    } catch (err) { throwRpcError(err); }
  }

  @Get('exercises/:exerciseId/my-submission')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Ma dernière soumission pour un exercice (STUDENT)' })
  async getMySubmission(@Param('exerciseId') exerciseId: string, @Req() req: any) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.MY_SUBMISSIONS, {
        studentId: req.user.userId,
        exerciseId,
      }));
    } catch (err) { throwRpcError(err); }
  }

  @Get('students/:childId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: "Voir la progression d'un enfant (PARENT uniquement)" })
  async getChildProgress(@Param('childId') childId: string, @Req() req: any) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.CHILD_PROGRESS, {
        parentId: req.user.userId,
        childId,
      }));
    } catch (err) { throwRpcError(err); }
  }

  @Post('exercises/submit')
  @ApiOperation({ summary: 'Soumettre un exercice (STUDENT)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['exerciseId', 'answer'],
      properties: {
        exerciseId: { type: 'string', example: 'uuid-of-exercise' },
        answer: { type: 'string', example: 'int led = 13; ...' },
      },
    },
  })
  async submitExercise(@Body() data: SubmitExerciseDto, @Req() req: any) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.SUBMIT_EXERCISE, {
        ...data,
        studentId: req.user.userId,
      }));
    } catch (err) { throwRpcError(err); }
  }

  @Post('update')
  @ApiOperation({ summary: "Mettre à jour la progression d'un module (STUDENT)" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['moduleId', 'completionPercent'],
      properties: {
        moduleId: { type: 'string', example: 'uuid-of-module' },
        completionPercent: { type: 'number', example: 50 },
      },
    },
  })
  async updateProgress(@Body() data: UpdateProgressionDto, @Req() req: any) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.UPDATE_PROGRESS, {
        ...data,
        studentId: req.user.userId,
      }));
    } catch (err) { throwRpcError(err); }
  }
}
