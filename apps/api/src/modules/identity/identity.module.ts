import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';

/**
 * 身份模块，封装身份相关的服务
 */
@Module({
  providers: [IdentityService], // 提供 IdentityService
  exports: [IdentityService], // 导出 IdentityService 供其他模块使用
})
export class IdentityModule {}
