import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IdentityModule } from '../identity/identity.module';

/**
 * 认证模块，整合认证相关的控制器与服务
 */
@Module({
  imports: [
    ConfigModule, // 配置模块
    IdentityModule, // 身份模块
    JwtModule.registerAsync({ // JWT 配置
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_ACCESS_SECRET'), // 访问令牌密钥
        signOptions: { expiresIn: '15m' }, // 访问令牌有效期
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
