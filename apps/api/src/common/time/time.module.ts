import { Global, Module } from '@nestjs/common';
import { Clock, SystemClock } from './clock';

// Global so any service can inject Clock without importing this module.
@Global()
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
export class TimeModule {}
