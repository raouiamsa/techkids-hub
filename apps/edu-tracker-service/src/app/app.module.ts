import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoursesModule } from './courses/courses.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { ProgressionModule } from './progression/progression.module';
import { DraftsModule } from './drafts/drafts.module';
import { LibraryModule } from './library/library.module';

@Module({
  imports: [CoursesModule, EnrollmentsModule, ProgressionModule, DraftsModule, LibraryModule],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
