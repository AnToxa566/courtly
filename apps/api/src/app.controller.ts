import { Controller, Get } from '@nestjs/common';
import { healthSchema, type Health } from '@courtly/contracts';
import { Public } from './common/auth/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth(): Health {
    return healthSchema.parse({ status: 'ok' });
  }
}
