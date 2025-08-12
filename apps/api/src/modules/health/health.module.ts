import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * 健康检查模块
 */
@Module({
  imports: [TerminusModule], // 引入 Terminus 提供的健康检查能力
  controllers: [HealthController], // 注册健康检查控制器
})
export class HealthModule {}
