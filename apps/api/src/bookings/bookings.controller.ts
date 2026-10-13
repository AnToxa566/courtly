import { Body, Controller, Post } from '@nestjs/common';
import {
  bookingSchema,
  createBookingRequestSchema,
  type Booking,
  type User,
} from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { BookingsService } from './bookings.service';

class CreateBookingDto extends createZodDto(createBookingRequestSchema) {}
class BookingDto extends createZodDto(bookingSchema) {}

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @ZodSerializerDto(BookingDto)
  create(
    @CurrentUser() user: User,
    @Body() body: CreateBookingDto,
  ): Promise<Booking> {
    return this.bookings.create(user.id, body);
  }
}
