import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

type AccessClaims = {
  sub: string;
  tid?: string;
  iid: string;
  itp: 'CONSUMER' | 'MERCHANT' | 'WORKER';
  roles: string[];
  ver: number;
};

@Injectable()
export class AuthService {
  private prisma = new PrismaClient();
  private redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380/0');

  constructor(private readonly jwt: JwtService) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async buildClaims(userId: string, preferred?: { identityId?: string; tenantId?: string; }) {
    const identities = await this.prisma.identity.findMany({ where: { userId } });
    if (!identities.length) throw new UnauthorizedException('No identity bound to this account');

    let current = preferred?.identityId
      ? identities.find(i => i.id === preferred.identityId)
      : identities[0];
    if (!current) current = identities[0];

    const tenantId = preferred?.tenantId ?? current?.tenantId ?? undefined;

    const memberships = await this.prisma.membership.findMany({
      where: { userId, ...(tenantId ? { tenantId } : {}) },
      include: { role: { select: { key: true } } },
    });
    const roles = [...new Set(memberships.map(m => m.role.key))];

    return { current, identities, roles, tenantId };
  }

  async issueAccess(userId: string, identityId?: string, tenantId?: string) {
    const { current, roles, tenantId: tid } = await this.buildClaims(userId, { identityId, tenantId });
    const payload: AccessClaims = {
      sub: userId,
      iid: current.id,
      itp: current.type as any,
      tid: tid,
      roles,
      ver: 1,
    };
    return this.jwt.signAsync(payload);
  }

  async issueRefresh(userId: string) {
    const tokenId = randomUUID();
    const ttl = 60 * 60 * 24 * 14; // 14d
    await this.redis.setex(`refresh:${tokenId}`, ttl, userId);
    return tokenId;
  }

  async verifyRefresh(refreshToken: string) {
    const userId = await this.redis.get(`refresh:${refreshToken}`);
    if (!userId) throw new UnauthorizedException('Refresh expired or revoked');
    return userId;
  }
}
