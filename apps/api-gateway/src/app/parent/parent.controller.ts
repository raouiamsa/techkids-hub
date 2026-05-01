import { Controller, Get, Post, Body, Param, Inject, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@org/auth';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@org/database';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { EDU_PATTERNS } from '@org/shared-types';
import { throwRpcError } from '../shared/rpc-error.helper';

@ApiTags('Parent')
@Controller('parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
@ApiBearerAuth()
export class ParentController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('EDU_SERVICE') private readonly eduClient: ClientProxy,
  ) {}

  /**
   * Returns the list of children linked to this parent,
   * along with their enrollments (with course modules) and progressions.
   */
  @Get('children')
  @ApiOperation({ summary: 'Voir mes enfants et leur progression (PARENT)' })
  async getMyChildren(@Req() req: any) {
    const parentId = req.user.userId;

    const children = await this.prisma.user.findMany({
      where: { parentId },
      select: {
        id: true,
        email: true,
        profile: {
          select: { firstName: true, lastName: true, avatar: true },
        },
        enrollments: {
          include: {
            course: {
              include: {
                modules: {
                  select: { id: true, title: true, order: true },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { enrolledAt: 'desc' },
        },
        progressions: {
          select: {
            moduleId: true,
            completionPercent: true,
            status: true,
            completedAt: true,
          },
        },
      },
    });

    return children;
  }

  /**
   * Link a child to this parent account by the child's email address.
   * Rules:
   * - Target user must exist and have role STUDENT
   * - Target user must not already be linked to ANOTHER parent
   *   (re-linking to the same parent is a no-op)
   */
  @Post('children/add')
  @ApiOperation({ summary: "Lier un enfant (STUDENT) à mon compte parent par email" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', example: 'enfant@example.com' },
      },
    },
  })
  async addChild(@Body('email') email: string, @Req() req: any) {
    const parentId = req.user.userId;

    if (!email || !email.includes('@')) {
      throw new HttpException('Adresse email invalide', HttpStatus.BAD_REQUEST);
    }

    // 1. Find the target student
    const student = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, role: true, parentId: true, profile: true },
    });

    if (!student) {
      throw new HttpException(
        `Aucun compte trouvé avec l'email "${email}"`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (student.role !== 'STUDENT') {
      throw new HttpException(
        'Ce compte n\'est pas un compte étudiant',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (student.parentId && student.parentId !== parentId) {
      throw new HttpException(
        'Cet étudiant est déjà lié à un autre compte parent',
        HttpStatus.CONFLICT,
      );
    }

    if (student.parentId === parentId) {
      return { message: 'Cet enfant est déjà lié à votre compte', alreadyLinked: true };
    }

    // 2. Link the student to this parent
    await this.prisma.user.update({
      where: { id: student.id },
      data: { parentId },
    });

    return {
      message: `${student.profile?.firstName ?? email} a été ajouté(e) avec succès à votre compte !`,
      childId: student.id,
    };
  }

  /**
   * Remove a child link from this parent account.
   */
  @Post('children/:childId/remove')
  @ApiOperation({ summary: "Supprimer le lien avec un enfant (PARENT)" })
  async removeChild(@Param('childId') childId: string, @Req() req: any) {
    const parentId = req.user.userId;

    const student = await this.prisma.user.findFirst({
      where: { id: childId, parentId },
    });

    if (!student) {
      throw new HttpException('Enfant introuvable ou non lié à votre compte', HttpStatus.NOT_FOUND);
    }

    await this.prisma.user.update({
      where: { id: childId },
      data: { parentId: null },
    });

    return { message: 'Le lien avec cet enfant a été supprimé' };
  }

  /**
   * Enroll a child in a course.
   */
  @Post('children/:childId/enrollments')
  @ApiOperation({ summary: "Inscrire mon enfant à un cours (PARENT)" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['courseId'],
      properties: {
        courseId: { type: 'string', example: 'uuid-of-course' },
      },
    },
  })
  async enrollChild(
    @Param('childId') childId: string,
    @Body('courseId') courseId: string,
    @Req() req: any,
  ) {
    const parentId = req.user.userId;

    // Verify child belongs to parent
    const student = await this.prisma.user.findFirst({
      where: { id: childId, parentId },
    });

    if (!student) {
      throw new HttpException('Enfant introuvable ou non lié à votre compte', HttpStatus.NOT_FOUND);
    }

    try {
      return await firstValueFrom(
        this.eduClient.send(EDU_PATTERNS.ENROLL, {
          studentId: childId,
          courseId,
        }),
      );
    } catch (err) { throwRpcError(err); }
  }

  /**
   * Returns the progression of a specific child.
   */
  @Get('children/:childId/progress')
  @ApiOperation({ summary: "Progression détaillée d'un enfant (PARENT)" })
  async getChildProgress(@Param('childId') childId: string, @Req() req: any) {
    try {
      return await firstValueFrom(
        this.eduClient.send(EDU_PATTERNS.CHILD_PROGRESS, {
          parentId: req.user.userId,
          childId,
        }),
      );
    } catch (err) { throwRpcError(err); }
  }
}
