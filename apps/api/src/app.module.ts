import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { TimeModule } from './common/time/time.module';
import { BookingsModule } from './bookings/bookings.module';
import { validateEnv } from './config/env';
import { CourtsModule } from './courts/courts.module';
import { FacilityModule } from './facility/facility.module';
import { PrismaModule } from './prisma/prisma.module';

// Global providers live here, not in configureApp, so that tests which build
// the app from AppModule get them too.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    TimeModule,
    AuthModule,
    FacilityModule,
    CourtsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [
    // Guards run in provider order: authentication first, roles second.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
