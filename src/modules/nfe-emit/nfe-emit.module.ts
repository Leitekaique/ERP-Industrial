import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NfeEmitController } from './nfe-emit.controller';
import { NfeEmitService } from './nfe-emit.service';
import { IbptService } from './ibpt.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NfeEmitController],
  providers: [NfeEmitService, IbptService],
  exports: [IbptService],
})
export class NfeEmitModule {}
