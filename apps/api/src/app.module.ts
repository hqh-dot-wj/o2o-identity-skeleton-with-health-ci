import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { HealthModule } from './modules/health/health.module';

/**
 * 应用根模块，汇集配置、限流、认证、身份和健康检查等子模块
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // 全局配置模块
    ThrottlerModule.forRoot([
      { ttl: 10_000, limit: 100 }, // 简易限流配置
    ]),
    AuthModule, // 认证模块
    IdentityModule, // 身份模块
    HealthModule, // 健康检查模块
  ],
})
export class AppModule {}
