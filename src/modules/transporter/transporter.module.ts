import { Module } from '@nestjs/common';
import { TransporterController } from './transporter.controller';
import { TransporterService } from './transporter.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [TransporterController],
  providers: [TransporterService, PrismaService],
})
export class TransporterModule {}
