import { Controller, Get, Post, Body, Param, Inject, UseGuards, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { EDU_PATTERNS, CreateCourseDto } from '@org/shared-types';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole } from '@prisma/client';
import { throwRpcError } from '../shared/rpc-error.helper';

@ApiTags('Edu-Tracker - Courses')
@Controller('courses')
export class CoursesController {
  constructor(@Inject('EDU_SERVICE') private readonly eduClient: ClientProxy) {}

  @Get()
  @ApiOperation({ summary: 'Liste tous les cours publiés (public)' })
  async getPublishedCourses() {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.COURSES_LIST, {}));
    } catch (err) { throwRpcError(err); }
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un cours par ID (public)" })
  async getCourseById(@Param('id') id: string) {
    try {
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.COURSES_GET, id));
    } catch (err) { throwRpcError(err); }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un cours (TEACHER uniquement)' })
  async createCourse(@Body() data: CreateCourseDto, @Req() req: any) {
    try {
      const payload = { ...data, teacherId: req.user.userId };
      return await firstValueFrom(this.eduClient.send(EDU_PATTERNS.COURSES_CREATE, payload));
    } catch (err) { throwRpcError(err); }
  }
}
