import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Named so the lifetime is one visible decision. Expiry uses the real system
// time inside @nestjs/jwt, not the Clock: it is security, not business time.
export const ACCESS_TOKEN_LIFETIME = '8h';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        // The algorithm is fixed on both sides, so a token cannot choose it.
        signOptions: { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_LIFETIME },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  // The global JwtAuthGuard, registered in AppModule, needs JwtService.
  exports: [JwtModule],
})
export class AuthModule {}
