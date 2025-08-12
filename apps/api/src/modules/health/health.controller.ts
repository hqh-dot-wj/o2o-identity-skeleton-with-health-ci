import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

/**
 * Prisma 数据库健康指示器
 */
class PrismaHealthIndicator extends HealthIndicator {
  /** Prisma 客户端 */
  private prisma = new PrismaClient();

  /**
   * 检查数据库连接是否正常
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`; // 简单查询
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError('Prisma check failed', e);
    }
  }
}

/**
 * Redis 健康指示器
 */
class RedisHealthIndicator extends HealthIndicator {
  /**
   * 检查 Redis 服务是否可用
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380/0'); // 创建 Redis 连接
    try {
      const pong = await redis.ping(); // 发送 PING
      await redis.quit(); // 关闭连接
      return this.getStatus(key, pong === 'PONG');
    } catch (e) {
      try { await redis.quit(); } catch {}
      throw new HealthCheckError('Redis check failed', e);
    }
  }
}

/**
 * 健康检查控制器
 */
@Controller('health')
export class HealthController {
  /** Prisma 健康指示器实例 */
  private prismaIndicator = new PrismaHealthIndicator();
  /** Redis 健康指示器实例 */
  private redisIndicator = new RedisHealthIndicator();

  /** 注入健康检查服务 */
  constructor(private health: HealthCheckService) {}

  /**
   * 活跃性探针
   */
  @Get('liveness')
  liveness() {
    return { status: 'ok' };
  }

  /**
   * 就绪性探针
   */
  @Get()
  @HealthCheck()
  readiness() {
    return this.health.check([
      async () => this.prismaIndicator.isHealthy('mysql'),
      async () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
