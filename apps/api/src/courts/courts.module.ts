import { Module } from '@nestjs/common';
import { AdminCourtsController } from './admin-courts.controller';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';

@Module({
  controllers: [CourtsController, AdminCourtsController],
  providers: [CourtsService],
})
export class CourtsModule {}
