import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 身份服务，提供身份查询和档案获取功能
 */
@Injectable()
export class IdentityService {
  /** Prisma 客户端 */
  private prisma = new PrismaClient();

  /**
   * 获取用户绑定的所有身份
   */
  async listUserIdentities(userId: string) {
    return this.prisma.identity.findMany({
      where: { userId },
      include: { tenant: true },
    });
  }

  /**
   * 获取用户档案信息（包含身份列表）
   */
  async getProfile(userId: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { id: userId } }); // 用户基本信息
    const identities = await this.listUserIdentities(userId); // 关联的身份列表
    return { user, identities };
  }
}
