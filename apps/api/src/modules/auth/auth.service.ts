import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient, IdentityType } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import * as https from 'https';
import { IncomingMessage } from 'http';

/** 访问令牌载荷 */
type AccessClaims = {
  /** 用户ID */
  sub: string;
  /** 租户ID，可选 */
  tid?: string;
  /** 身份ID */
  iid: string;
  /** 身份类型 */
  itp: 'CONSUMER' | 'MERCHANT' | 'WORKER';
  /** 角色列表 */
  roles: string[];
  /** 版本号 */
  ver: number;
};

/**
 * 认证服务，封装登录、令牌签发等核心逻辑
 */
@Injectable()
export class AuthService {
  /** Prisma 客户端 */
  private prisma = new PrismaClient();
  /** Redis 客户端，用于存储刷新令牌 */
  private redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380/0');

  /** 注入 JWT 服务 */
  constructor(private readonly jwt: JwtService) {}

  /**
   * 校验用户邮箱与密码
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { email } }); // 查询用户
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials'); // 用户不存在或已禁用
    }
    const ok = await argon2.verify(user.passwordHash, password); // 验证密码
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  /**
   * 构建访问令牌所需的声明信息
   */
  async buildClaims(userId: string, preferred?: { identityId?: string; tenantId?: string; }) {
    const identities = await this.prisma.identity.findMany({ where: { userId } }); // 查询用户的所有身份
    if (!identities.length) throw new UnauthorizedException('No identity bound to this account');

    // 根据传入的首选身份选择当前身份
    let current = preferred?.identityId
      ? identities.find(i => i.id === preferred.identityId)
      : identities[0];
    if (!current) current = identities[0];

    const tenantId = preferred?.tenantId ?? current?.tenantId ?? undefined; // 计算租户ID

    const memberships = await this.prisma.membership.findMany({
      where: { userId, ...(tenantId ? { tenantId } : {}) },
      include: { role: { select: { key: true } } },
    });
    const roles = [...new Set(memberships.map(m => m.role.key))]; // 提取角色列表

    return { current, identities, roles, tenantId };
  }

  /**
   * 签发访问令牌
   */
  async issueAccess(userId: string, identityId?: string, tenantId?: string) {
    const { current, roles, tenantId: tid } = await this.buildClaims(userId, { identityId, tenantId }); // 构建声明
    const payload: AccessClaims = {
      sub: userId, // 用户ID
      iid: current.id, // 当前身份ID
      itp: current.type as any, // 身份类型
      tid: tid, // 租户ID
      roles, // 角色列表
      ver: 1, // 版本号
    };
    return this.jwt.signAsync(payload); // 签发 JWT
  }

  /**
   * 签发刷新令牌
   */
  async issueRefresh(userId: string) {
    const tokenId = randomUUID(); // 生成刷新令牌ID
    const ttl = 60 * 60 * 24 * 14; // 14d
    await this.redis.setex(`refresh:${tokenId}`, ttl, userId); // 写入 Redis
    return tokenId;
  }

  /**
   * 校验刷新令牌
   */
  async verifyRefresh(refreshToken: string) {
    const userId = await this.redis.get(`refresh:${refreshToken}`); // 从 Redis 获取用户ID
    if (!userId) throw new UnauthorizedException('Refresh expired or revoked');
    return userId;
  }

  /**
   * 作废刷新令牌，实现登出
   */
  async logout(refreshToken: string) {
    await this.redis.del(`refresh:${refreshToken}`); // 删除 Redis 中的令牌
  }

  /**
   * 通过手机验证码登录或注册
   */
  async loginWithPhoneCode(phone: string, _code: string) {
    let user = await this.prisma.userAccount.findUnique({ where: { phone } });
    if (user) {
      if (!user.isActive) throw new UnauthorizedException('Account disabled');
      return user;
    }
    user = await this.prisma.userAccount.create({
      data: {
        phone,
        isActive: true,
        identities: { create: { type: IdentityType.CONSUMER } }, // 创建默认消费者身份
      },
    });
    return user;
  }

  /**
   * 通过微信小程序登录或注册
   */
  async loginWithWechat(code: string) {
    const appid = process.env.WECHAT_APPID; // 微信 AppID
    const secret = process.env.WECHAT_SECRET; // 微信密钥
    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    const data: any = await new Promise((resolve, reject) => {
      https
        .get(url, (res: IncomingMessage) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk)); // 拼接返回体
          res.on('end', () => {
            try {
              resolve(JSON.parse(body)); // 解析 JSON
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
    if (!data.openid) throw new UnauthorizedException('Invalid wechat code');

    const existing = await this.prisma.userProvider.findUnique({
      where: { provider_openId: { provider: 'WECHAT', openId: data.openid } },
      include: { user: true },
    });
    if (existing) return existing.user; // 若已绑定则直接返回

    const user = await this.prisma.userAccount.create({
      data: {
        providers: { create: { provider: 'WECHAT', openId: data.openid, unionId: data.unionid } }, // 绑定微信账号
        identities: { create: { type: IdentityType.CONSUMER } }, // 创建默认消费者身份
      },
    });
    return user;
  }
}
