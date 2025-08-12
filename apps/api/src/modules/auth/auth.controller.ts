import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdentityService } from '../identity/identity.service';

/** 登录请求体 */
class LoginDto {
  /** 用户邮箱 */
  email!: string;
  /** 登录密码 */
  password!: string;
  /** 期望切换的身份ID，可选 */
  identityId?: string;
  /** 期望切换的租户ID，可选 */
  tenantId?: string;
}

/** 刷新/登出请求体 */
class RefreshDto {
  /** 刷新令牌 */
  refreshToken!: string;
}

/** 微信小程序登录请求体 */
class WechatLoginDto {
  /** 微信登录临时code */
  code!: string;
}

/** 切换身份请求体 */
class SwitchIdentityDto {
  /** 目标身份ID */
  identityId!: string;
  /** 目标租户ID，可选 */
  tenantId?: string;
}

/**
 * 认证控制器，负责处理登录、刷新、登出等操作
 */
@Controller()
export class AuthController {
  /** 注入认证服务和身份服务 */
  constructor(private readonly auth: AuthService, private readonly identity: IdentityService) {}

  /**
   * 使用账号密码登录
   */
  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const user = await this.auth.validateUser(dto.email, dto.password); // 校验账号密码
    const accessToken = await this.auth.issueAccess(user.id, dto.identityId, dto.tenantId); // 签发访问令牌
    const refreshToken = await this.auth.issueRefresh(user.id); // 签发刷新令牌
    const identities = await this.identity.listUserIdentities(user.id); // 获取当前账号的所有身份
    return { accessToken, refreshToken, identities };
  }

  /**
   * 通过微信小程序登录
   */
  @Post('auth/login/wechat')
  @HttpCode(200)
  async loginWechat(@Body() dto: WechatLoginDto) {
    const user = await this.auth.loginWithWechat(dto.code); // 使用微信code登录或注册
    const accessToken = await this.auth.issueAccess(user.id); // 签发访问令牌
    const refreshToken = await this.auth.issueRefresh(user.id); // 签发刷新令牌
    const identities = await this.identity.listUserIdentities(user.id); // 获取当前账号的所有身份
    return { accessToken, refreshToken, identities };
  }

  /**
   * 通过刷新令牌获取新的访问令牌
   */
  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    const userId = await this.auth.verifyRefresh(dto.refreshToken); // 验证刷新令牌并获取用户ID
    const accessToken = await this.auth.issueAccess(userId); // 签发新的访问令牌
    return { accessToken };
  }

  /**
   * 登出并作废刷新令牌
   */
  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken); // 删除刷新令牌
    return { ok: true };
  }

  /**
   * 切换当前访问身份
   */
  @UseGuards(JwtAccessGuard)
  @Post('auth/switch-identity')
  async switchIdentity(@CurrentUser() user: any, @Body() dto: SwitchIdentityDto) {
    const accessToken = await this.auth.issueAccess(user.sub, dto.identityId, dto.tenantId); // 根据新的身份签发访问令牌
    return { accessToken };
  }

  /**
   * 获取当前用户信息
   */
  @UseGuards(JwtAccessGuard)
  @Get('me')
  async me(@CurrentUser() user: any) {
    const profile = await this.identity.getProfile(user.sub); // 获取用户档案信息
    return { claims: user, profile };
  }
}
