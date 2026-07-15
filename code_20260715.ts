import { Injectable, Logger } from '@nestjs/common';
import Aria2 from 'aria2';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class BtService {
  private readonly aria2: Aria2;
  private readonly logger = new Logger(BtService.name);
  private readonly tempDir: string;
  private readonly storageRoot: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.aria2 = new Aria2({
      host: this.config.get('ARIA2_HOST'),
      port: this.config.get('ARIA2_PORT'),
      secret: this.config.get('ARIA2_RPC_SECRET'),
    });
    this.tempDir = this.config.get('ARIA2_TMP_DIR');
    this.storageRoot = this.config.get('STORAGE_ROOT');
    this.aria2.open();
    this.watchDownloadComplete();
  }

  /** 创建离线任务：磁力/种子链接 */
  async createTask(userId: string, source: string, targetFolderId: string, type: 'magnet' | 'torrent' | 'url') {
    let gid: string;
    const opt = { dir: this.tempDir };
    if (type === 'magnet') {
      gid = await this.aria2.addUri([source], opt);
    } else if (type === 'torrent') {
      const buf = Buffer.from(source, 'base64');
      const tmpTorrentPath = path.join(this.tempDir, `${Date.now()}.torrent`);
      await fs.writeFile(tmpTorrentPath, buf);
      gid = await this.aria2.addTorrent(tmpTorrentPath, [], opt);
    } else {
      gid = await this.aria2.addUri([source], opt);
    }

    const task = await this.prisma.btDownloadTask.create({
      data: {
        userId,
        rpcGid: gid,
        taskType: type,
        source,
        targetFolderId,
        status: 'PENDING',
      },
    });
    return task;
  }

  /** 获取用户全部任务 */
  getUserTasks(userId: string) {
    return this.prisma.btDownloadTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pauseTask(taskId: string) {
    const task = await this.prisma.btDownloadTask.findUnique({ where: { id: taskId } });
    if (!task.rpcGid) return;
    await this.aria2.pause(task.rpcGid);
    await this.prisma.btDownloadTask.update({
      where: { id: taskId },
      data: { status: 'PAUSED' },
    });
  }

  async resumeTask(taskId: string) {
    const task = await this.prisma.btDownloadTask.findUnique({ where: { id: taskId } });
    if (!task.rpcGid) return;
    await this.aria2.unpause(task.rpcGid);
    await this.prisma.btDownloadTask.update({
      where: { id: taskId },
      data: { status: 'DOWNLOADING' },
    });
  }

  /** 监听Aria2下载完成，自动迁移文件至网盘 */
  private watchDownloadComplete() {
    this.aria2.on('download-complete', async (event) => {
      const gid = event.gid;
      const task = await this.prisma.btDownloadTask.findFirst({
        where: { rpcGid: gid },
      });
      if (!task) return;

      const files = await this.aria2.getFiles(gid);
      for (const fileInfo of files) {
        const srcPath = fileInfo.path;
        const destFolder = path.join(this.storageRoot, userId, task.targetFolderId);
        await fs.ensureDir(destFolder);
        const destPath = path.join(destFolder, path.basename(srcPath));
        await fs.move(srcPath, destPath, { overwrite: true });

        // 写入文件数据库记录，和手动上传文件统一管理
        const stat = await fs.stat(destPath);
        await this.prisma.file.create({
          data: {
            name: path.basename(srcPath),
            size: BigInt(stat.size),
            path: destPath,
            userId: task.userId,
            folderId: task.targetFolderId,
          },
        });
      }

      await this.prisma.btDownloadTask.update({
        where: { id: task.id },
        data: { status: 'COMPLETED', finishedAt: new Date() },
      });
    });
  }
}
