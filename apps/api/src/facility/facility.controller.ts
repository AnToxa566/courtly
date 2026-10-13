import { Controller, Get } from '@nestjs/common';
import { facilitySchema, type Facility } from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { FacilityService } from './facility.service';

class FacilityDto extends createZodDto(facilitySchema) {}

@Controller('facility')
export class FacilityController {
  constructor(private readonly facility: FacilityService) {}

  @Get()
  @ZodSerializerDto(FacilityDto)
  get(): Facility {
    return this.facility.getFacility();
  }
}
