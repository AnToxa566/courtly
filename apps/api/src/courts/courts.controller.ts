import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  availabilityQuerySchema,
  availabilitySchema,
  courtSchema,
  type Availability,
  type Court,
} from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { IdParamDto } from '../common/id-param.dto';
import { CourtsService } from './courts.service';

class CourtDto extends createZodDto(courtSchema) {}
class AvailabilityQueryDto extends createZodDto(availabilityQuerySchema) {}
class AvailabilityDto extends createZodDto(availabilitySchema) {}

@Controller('courts')
export class CourtsController {
  constructor(private readonly courts: CourtsService) {}

  @Get()
  @ZodSerializerDto([CourtDto])
  list(): Promise<Court[]> {
    return this.courts.listActive();
  }

  @Get(':id')
  @ZodSerializerDto(CourtDto)
  get(@Param() { id }: IdParamDto): Promise<Court> {
    return this.courts.findActive(id);
  }

  @Get(':id/availability')
  @ZodSerializerDto(AvailabilityDto)
  availability(
    @Param() { id }: IdParamDto,
    @Query() { date }: AvailabilityQueryDto,
  ): Promise<Availability> {
    return this.courts.getAvailability(id, date);
  }
}
