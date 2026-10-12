import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  loginRequestSchema,
  loginResponseSchema,
  userSchema,
  type LoginResponse,
  type User,
} from '@courtly/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { AuthService } from './auth.service';

class LoginRequestDto extends createZodDto(loginRequestSchema) {}
class LoginResponseDto extends createZodDto(loginResponseSchema) {}
class UserDto extends createZodDto(userSchema) {}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ZodSerializerDto(LoginResponseDto)
  login(@Body() body: LoginRequestDto): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @Get('me')
  @ZodSerializerDto(UserDto)
  me(@CurrentUser() user: User): User {
    return user;
  }
}
