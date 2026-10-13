import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  courtSchema,
  createCourtRequestSchema,
  updateCourtRequestSchema,
  type Court,
} from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { Roles } from '../common/auth/roles.decorator';
import { IdParamDto } from '../common/id-param.dto';
import { CourtsService } from './courts.service';

class CourtDto extends createZodDto(courtSchema) {}
class CreateCourtDto extends createZodDto(createCourtRequestSchema) {}
class UpdateCourtDto extends createZodDto(updateCourtRequestSchema) {}

// The role is on the class, so a route added here later is admin-only too.
@Roles('ADMIN')
@Controller('admin/courts')
export class AdminCourtsController {
  constructor(private readonly courts: CourtsService) {}

  @Get()
  @ZodSerializerDto([CourtDto])
  list(): Promise<Court[]> {
    return this.courts.listAll();
  }

  @Post()
  @ZodSerializerDto(CourtDto)
  create(@Body() body: CreateCourtDto): Promise<Court> {
    return this.courts.create(body);
  }

  @Patch(':id')
  @ZodSerializerDto(CourtDto)
  update(
    @Param() { id }: IdParamDto,
    @Body() body: UpdateCourtDto,
  ): Promise<Court> {
    return this.courts.update(id, body);
  }
}
