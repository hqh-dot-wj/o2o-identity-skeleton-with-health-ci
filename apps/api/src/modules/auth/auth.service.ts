import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import Redis from 'ioredis';

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

  async validatePhonePassword(phone: string, password: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { phone } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async validatePhoneCode(phone: string, code: string) {
    const stored = await this.redis.get(`sms:${phone}`);
    if (stored !== code) throw new UnauthorizedException('Invalid code');
    let user = await this.prisma.userAccount.findUnique({ where: { phone } });
    if (!user) {
      const passwordHash = await argon2.hash(crypto.randomUUID());
      user = await this.prisma.userAccount.create({
        data: { phone, passwordHash },
      });
    }
    if (!user.isActive) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async loginWithWechat(code: string, phone: string) {
    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;
    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    const session = await fetch(url).then((r) => r.json());
    const openid = session.openid as string | undefined;
    const unionid = session.unionid as string | undefined;
    if (!openid) throw new UnauthorizedException('Invalid wechat code');

    let user = await this.prisma.userAccount.findFirst({
      where: { OR: [{ wechatOpenId: openid }, { phone }] },
    });

    if (!user) {
      const passwordHash = await argon2.hash(crypto.randomUUID());
      user = await this.prisma.userAccount.create({
        data: { phone, passwordHash, wechatOpenId: openid, wechatUnionId: unionid },
      });
    } else {
      const data: any = { wechatOpenId: openid, wechatUnionId: unionid };
      if (!user.phone && phone) data.phone = phone;
      user = await this.prisma.userAccount.update({ where: { id: user.id }, data });
    }

    if (!user.isActive) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async buildClaims(userId: string, preferred?: { identityId?: string; tenantId?: string; }) {
    const identities = await this.prisma.identity.findMany({ where: { userId } });
    if (!identities.length) throw new UnauthorizedException('No identity bound to this account');

    let current = preferred?.identityId
      ? identities.find((i: any) => i.id === preferred.identityId)
      : identities[0];
    if (!current) current = identities[0];

    const tenantId = preferred?.tenantId ?? current?.tenantId ?? undefined;

    const memberships = await this.prisma.membership.findMany({
      where: { userId, ...(tenantId ? { tenantId } : {}) },
      include: { role: { select: { key: true } } },
    });
    const roles = Array.from(new Set<string>(memberships.map((m: any) => m.role.key)));

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
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    await this.prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });
    return token;
  }

  async verifyRefresh(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh expired or revoked');
    }
    return record.userId;
  }

  async revokeRefresh(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
