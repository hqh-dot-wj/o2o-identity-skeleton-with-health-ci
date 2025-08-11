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

class PrismaHealthIndicator extends HealthIndicator {
  private prisma = new PrismaClient();
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError('Prisma check failed', e);
    }
  }
}

class RedisHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380/0');
    try {
      const pong = await redis.ping();
      await redis.quit();
      return this.getStatus(key, pong === 'PONG');
    } catch (e) {
      try { await redis.quit(); } catch {}
      throw new HealthCheckError('Redis check failed', e);
    }
  }
}

@Controller('health')
export class HealthController {
  private prismaIndicator = new PrismaHealthIndicator();
  private redisIndicator = new RedisHealthIndicator();

  constructor(private health: HealthCheckService) {}

  @Get('liveness')
  liveness() {
    return { status: 'ok' };
  }

  @Get()
  @HealthCheck()
  readiness() {
    return this.health.check([
      async () => this.prismaIndicator.isHealthy('mysql'),
      async () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
