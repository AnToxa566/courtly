import { Controller, Get, Param } from '@nestjs/common';
import { courtSchema, type Court } from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { IdParamDto } from '../common/id-param.dto';
import { CourtsService } from './courts.service';

class CourtDto extends createZodDto(courtSchema) {}

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
}
