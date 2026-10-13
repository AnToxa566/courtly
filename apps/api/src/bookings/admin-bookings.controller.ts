import { Controller, Get, Query } from '@nestjs/common';
import {
  adminDayQuerySchema,
  adminDaySchema,
  type AdminDay,
} from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { Roles } from '../common/auth/roles.decorator';
import { BookingsService } from './bookings.service';

class AdminDayQueryDto extends createZodDto(adminDayQuerySchema) {}
class AdminDayDto extends createZodDto(adminDaySchema) {}

// The role is on the class, so a route added here later is admin-only too.
@Roles('ADMIN')
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @ZodSerializerDto(AdminDayDto)
  day(@Query() { date }: AdminDayQueryDto): Promise<AdminDay> {
    return this.bookings.listDay(date);
  }
}
