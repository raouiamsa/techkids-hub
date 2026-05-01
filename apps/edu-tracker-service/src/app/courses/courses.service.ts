import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { CreateCourseDto } from '@org/shared-types';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async getPublishedCourses() {
    return this.prisma.course.findMany({
      where: { isPublished: true },
      include: {
        teacher: {
          select: { id: true, email: true, profile: true },
        },
      },
    });
  }

  async getCourseById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            exercises: true,
          },
        },
        teacher: {
          select: { id: true, email: true, profile: true },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  async createCourse(data: CreateCourseDto & { teacherId: string }) {
    return this.prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        level: data.level,
        teacherId: data.teacherId,
        isPublished: false, // Default to unpublished
      },
    });
  }
}
