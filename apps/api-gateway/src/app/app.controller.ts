import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole } from '@prisma/client';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  // Route PUBLIQUE (accessible sans token)
  @Get()
  getData() {
    return this.appService.getData();
  }

  // Route requiert juste un token valide (tous les rôles)
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    return { message: ' Connecté !', user: req.user };
  }

  // Route réservée aux ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/dashboard')
  adminDashboard(@Req() req: any) {
    return { message: ' Accès ADMIN autorisé', user: req.user };
  }

  // Route réservée aux TEACHER
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @Get('teacher/courses')
  teacherCourses(@Req() req: any) {
    return { message: ' Accès TEACHER autorisé', user: req.user };
  }

  // Route réservée aux PARENT
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  @Get('parent/children')
  parentChildren(@Req() req: any) {
    return { message: ' Accès PARENT autorisé', user: req.user };
  }

  // Route réservée aux STUDENT
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @Get('student/progress')
  studentProgress(@Req() req: any) {
    return { message: ' Accès STUDENT autorisé', user: req.user };
  }
}
