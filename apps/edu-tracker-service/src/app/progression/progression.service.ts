import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { SubmitExerciseDto, UpdateProgressionDto } from '@org/shared-types';

@Injectable()
export class ProgressionService {
  constructor(private prisma: PrismaService) {}

  async getMyProgress(studentId: string) {
    return this.prisma.progression.findMany({
      where: { studentId },
      include: {
        module: {
          select: { id: true, title: true, courseId: true },
        },
      },
    });
  }

  async getChildProgress(parentId: string, childId: string) {
    // 1. Verify that 'childId' actually belongs to 'parentId'
    // By convention in the User schema, a student has a 'parentId' linking them to their parent
    const child = await this.prisma.user.findUnique({
      where: { id: childId },
      select: { parentId: true },
    });

    if (!child || child.parentId !== parentId) {
      // Throw access denied HTTP-like error compatible with our handleRpcError
      throw new NotFoundException(`Enfant non trouvé ou n'appartient pas à ce parent`);
    }

    // 2. Return progression (same query as getMyProgress)
    return this.getMyProgress(childId);
  }

  async submitExercise(data: SubmitExerciseDto & { studentId: string }) {
    // 1. Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: data.exerciseId },
    });
    if (!exercise) {
      throw new NotFoundException(`Exercise not found`);
    }

    // 2. Mock Score Evaluation (For now, auto 100 on code/circuit, validate quizzes later)
    const score = 100;

    // 3. Find current attempt count
    const previousSubmissions = await this.prisma.submission.count({
      where: { studentId: data.studentId, exerciseId: data.exerciseId },
    });

    // 4. Create submission
    const submission = await this.prisma.submission.create({
      data: {
        studentId: data.studentId,
        exerciseId: data.exerciseId,
        answer: data.answer,
        score,
        attempt: previousSubmissions + 1,
      },
    });

    // 5. Optionally recalculate module progression here
    await this.recalculateModuleProgression(data.studentId, exercise.moduleId);

    return submission;
  }

  async updateProgress(data: UpdateProgressionDto & { studentId: string }) {
    // Compute status automatically based on percent
    const status =
      data.completionPercent === 0
        ? 'NOT_STARTED'
        : data.completionPercent === 100
          ? 'COMPLETED'
          : 'IN_PROGRESS';

    return this.prisma.progression.upsert({
      where: {
        studentId_moduleId: {
          studentId: data.studentId,
          moduleId: data.moduleId,
        },
      },
      update: {
        completionPercent: data.completionPercent,
        status,
        completedAt: data.completionPercent === 100 ? new Date() : null,
      },
      create: {
        studentId: data.studentId,
        moduleId: data.moduleId,
        completionPercent: data.completionPercent,
        status,
        completedAt: data.completionPercent === 100 ? new Date() : null,
      },
    });
  }

  async getMySubmissionForExercise(studentId: string, exerciseId: string) {
    // Return the last submission for this student+exercise
    return this.prisma.submission.findFirst({
      where: { studentId, exerciseId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        answer: true,
        score: true,
        attempt: true,
        submittedAt: true,
      },
    });
  }

  private async recalculateModuleProgression(studentId: string, moduleId: string) {
    // 1. Count total exercises in the module
    const totalExercises = await this.prisma.exercise.count({
      where: { moduleId },
    });

    if (totalExercises === 0) return; // Nothing to calculate

    // 2. Count distinct exercises that the student has submitted at least once
    const submittedExercises = await this.prisma.submission.findMany({
      where: {
        studentId,
        exercise: { moduleId },
      },
      select: { exerciseId: true },
      distinct: ['exerciseId'],
    });

    const solvedCount = submittedExercises.length;

    // 3. Compute progression percentage (rounded to nearest integer)
    const completionPercent = Math.round((solvedCount / totalExercises) * 100);

    // 4. Derive status from the percentage
    const status =
      completionPercent === 0
        ? 'NOT_STARTED'
        : completionPercent === 100
          ? 'COMPLETED'
          : 'IN_PROGRESS';

    // 5. Upsert the Progression record
    await this.prisma.progression.upsert({
      where: {
        studentId_moduleId: { studentId, moduleId },
      },
      update: {
        completionPercent,
        status,
        completedAt: completionPercent === 100 ? new Date() : null,
      },
      create: {
        studentId,
        moduleId,
        completionPercent,
        status,
        completedAt: completionPercent === 100 ? new Date() : null,
      },
    });
  }
}
