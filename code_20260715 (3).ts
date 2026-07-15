import { Module } from '@nestjs/common';
import { BtService } from './bt.service';
import { BtController } from './bt.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BtService],
  controllers: [BtController],
  exports: [BtService],
})
export class BtModule {}
