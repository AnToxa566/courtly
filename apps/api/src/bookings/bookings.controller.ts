import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  bookingSchema,
  createBookingRequestSchema,
  myBookingsQuerySchema,
  type Booking,
  type User,
} from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { IdParamDto } from '../common/id-param.dto';
import { BookingsService } from './bookings.service';

class CreateBookingDto extends createZodDto(createBookingRequestSchema) {}
class BookingDto extends createZodDto(bookingSchema) {}
class MyBookingsQueryDto extends createZodDto(myBookingsQuerySchema) {}

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

  @Get('mine')
  @ZodSerializerDto([BookingDto])
  listMine(
    @CurrentUser() user: User,
    @Query() { scope }: MyBookingsQueryDto,
  ): Promise<Booking[]> {
    return this.bookings.listMine(user.id, scope);
  }

  // 200, not 201: nothing is created, the booking is updated.
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(BookingDto)
  cancel(
    @CurrentUser() user: User,
    @Param() { id }: IdParamDto,
  ): Promise<Booking> {
    return this.bookings.cancel(user.id, id);
  }
}
