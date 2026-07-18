import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { BtService } from './bt.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('bt-task')
@UseGuards(AuthGuard)
export class BtController {
  constructor(private btService: BtService) {}

  @Post('create')
  create(@CurrentUser() user, @Body() dto: {source:string;targetFolderId:string;type:'magnet'|'torrent'|'url'}) {
    return this.btService.createTask(user.id, dto.source, dto.targetFolderId, dto.type);
  }

  @Get('list')
  list(@CurrentUser() user) {
    return this.btService.getUserTasks(user.id);
  }

  @Post(':id/pause')
  pause(@Param('id') id: string) {
    return this.btService.pauseTask(id);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.btService.resumeTask(id);
  }
}
