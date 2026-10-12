import { Controller, Get } from '@nestjs/common';
import { healthSchema, type Health } from '@courtly/contracts';

@Controller()
export class AppController {
  @Get('health')
  getHealth(): Health {
    return healthSchema.parse({ status: 'ok' });
  }
}
