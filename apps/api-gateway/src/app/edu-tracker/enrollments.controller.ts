import { Controller, Post, Get, Body, Inject, UseGuards, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { EDU_PATTERNS } from '@org/shared-types';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole } from '@prisma/client';
import { throwRpcError } from '../shared/rpc-error.helper';

@ApiTags('Edu-Tracker - Enrollments')
@Controller('enrollments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EnrollmentsController {
  constructor(@Inject('EDU_SERVICE') private readonly eduClient: ClientProxy) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Inscrire l'étudiant à un cours (STUDENT ou PARENT)" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['courseId'],
      properties: {
        courseId: { type: 'string', example: 'uuid-of-course' },
      },
    },
  })
  async enrollStudent(@Body('courseId') courseId: string, @Req() req: any) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.ENROLL, {
        studentId: req.user.userId,
        courseId,
      }));
    } catch (err) { throwRpcError(err); }
  }

  @Get('my')
  @ApiOperation({ summary: 'Voir mes inscriptions (tout utilisateur connecté)' })
  async getMyEnrollments(@Req() req: any) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.MY_ENROLLMENTS, req.user.userId));
    } catch (err) { throwRpcError(err); }
  }
}
