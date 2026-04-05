import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProgressionService } from './progression.service';
import { EDU_PATTERNS, SubmitExerciseDto, UpdateProgressionDto } from '@org/shared-types';

@Controller()
export class ProgressionController {
  constructor(private readonly progressionService: ProgressionService) { }

  @MessagePattern(EDU_PATTERNS.MY_PROGRESS)
  async getMyProgress(@Payload() studentId: string) {
    console.log('EDU-SERVICE: MY_PROGRESS', studentId);
    return this.progressionService.getMyProgress(studentId);
  }

  @MessagePattern(EDU_PATTERNS.CHILD_PROGRESS)
  async getChildProgress(@Payload() data: { parentId: string; childId: string }) {
    console.log('EDU-SERVICE: CHILD_PROGRESS', data);
    return this.progressionService.getChildProgress(data.parentId, data.childId);
  }

  @MessagePattern(EDU_PATTERNS.SUBMIT_EXERCISE)
  async submitExercise(
    @Payload() data: SubmitExerciseDto & { studentId: string }
  ) {
    return this.progressionService.submitExercise(data);
  }

  @MessagePattern(EDU_PATTERNS.UPDATE_PROGRESS)
  async updateProgress(
    @Payload() data: UpdateProgressionDto & { studentId: string }
  ) {
    return this.progressionService.updateProgress(data);
  }
}
