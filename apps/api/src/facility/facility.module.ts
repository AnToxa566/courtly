import { Module } from '@nestjs/common';
import { FacilityController } from './facility.controller';
import { FacilityService } from './facility.service';

@Module({
  controllers: [FacilityController],
  providers: [FacilityService],
})
export class FacilityModule {}
