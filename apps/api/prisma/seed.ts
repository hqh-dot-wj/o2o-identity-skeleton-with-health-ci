import { PrismaClient, IdentityType } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  await prisma.permission.upsert({ where: { key: 'user.read' }, update: {}, create: { key: 'user.read', name: 'Read Users' } });
  await prisma.permission.upsert({ where: { key: 'user.manage' }, update: {}, create: { key: 'user.manage', name: 'Manage Users' } });

  const roleConsumer = await prisma.role.upsert({
    where: { key: 'consumer.basic' }, update: {}, create: { key: 'consumer.basic', name: 'Consumer Basic' },
  });
  const roleMerchantAdmin = await prisma.role.upsert({
    where: { key: 'merchant.admin' }, update: {}, create: { key: 'merchant.admin', name: 'Merchant Admin' },
  });
  const roleWorkerBasic = await prisma.role.upsert({
    where: { key: 'worker.basic' }, update: {}, create: { key: 'worker.basic', name: 'Worker Basic' },
  });

  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' },
    update: {},
    create: { id: 'demo-tenant', name: 'Demo Merchant', type: 'MERCHANT' },
  });

  const hash = await argon2.hash('Passw0rd!');
  const user = await prisma.userAccount.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', passwordHash: hash },
  });

  const consumerId = await prisma.identity.upsert({
    where: { id: 'id_consumer_default' },
    update: {},
    create: { id: 'id_consumer_default', userId: user.id, type: IdentityType.CONSUMER, displayName: 'Consumer' },
  });

  const merchantId = await prisma.identity.upsert({
    where: { id: 'id_merchant_demo' },
    update: {},
    create: { id: 'id_merchant_demo', userId: user.id, tenantId: tenant.id, type: IdentityType.MERCHANT, displayName: 'Merchant Admin' },
  });

  const workerId = await prisma.identity.upsert({
    where: { id: 'id_worker_demo' },
    update: {},
    create: { id: 'id_worker_demo', userId: user.id, type: IdentityType.WORKER, displayName: 'Worker' },
  });

  await prisma.membership.upsert({
    where: { id: 'm_demo_merchant_admin' },
    update: {},
    create: { id: 'm_demo_merchant_admin', userId: user.id, tenantId: tenant.id, roleId: roleMerchantAdmin.id, defaultIdentityId: merchantId.id },
  });

  console.log('Seed completed. Login with admin@example.com / Passw0rd!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
