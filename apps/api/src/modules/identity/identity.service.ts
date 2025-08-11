import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class IdentityService {
  private prisma = new PrismaClient();

  async listUserIdentities(userId: string) {
    return this.prisma.identity.findMany({
      where: { userId },
      include: { tenant: true },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { id: userId } });
    const identities = await this.listUserIdentities(userId);
    return { user, identities };
  }
}
