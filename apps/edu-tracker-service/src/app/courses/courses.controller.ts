import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CoursesService } from './courses.service';
import { EDU_PATTERNS, CreateCourseDto } from '@org/shared-types';

@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) { }

  @MessagePattern(EDU_PATTERNS.COURSES_LIST)
  async getPublishedCourses() {
    return this.coursesService.getPublishedCourses();
  }

  @MessagePattern(EDU_PATTERNS.COURSES_GET)
  async getCourseById(@Payload() id: string) {
    return this.coursesService.getCourseById(id);
  }

  @MessagePattern(EDU_PATTERNS.COURSES_CREATE)
  async createCourse(@Payload() data: CreateCourseDto & { teacherId: string }) {
    return this.coursesService.createCourse(data);
  }
}
