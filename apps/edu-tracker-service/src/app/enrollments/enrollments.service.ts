import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  async enrollStudent(studentId: string, courseId: string) {
    // 1. Check if course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course not found`);
    }

    // 2. Check if already enrolled
    const existing = await this.prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Already enrolled in this course`);
    }

    // 3. Create enrollment
    return this.prisma.enrollment.create({
      data: {
        studentId,
        courseId,
        status: 'ACTIVE',
      },
      include: {
        course: true,
      },
    });
  }

  async getMyEnrollments(studentId: string) {
    return this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        course: {
          include: {
            teacher: {
              select: { id: true, email: true, profile: true },
            },
            modules: {
              select: { id: true, title: true, order: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
