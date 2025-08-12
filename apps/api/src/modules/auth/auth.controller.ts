import { BadRequestException, Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdentityService } from '../identity/identity.service';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/** 登录请求体 */
class LoginDto {
  /** 用户手机号 */
  @IsString()
  @IsNotEmpty()
  phone!: string;
  /** 登录密码，可选 */
  @IsString()
  @IsOptional()
  password?: string;
  /** 短信验证码，可选 */
  @IsString()
  @IsOptional()
  code?: string;
  /** 期望切换的身份ID，可选 */
  @IsUUID()
  @IsOptional()
  identityId?: string;
  /** 期望切换的租户ID，可选 */
  @IsUUID()
  @IsOptional()
  tenantId?: string;
}

/** 请求短信验证码 */
class SmsDto {
  /** 用户手机号 */
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

/** 刷新/登出请求体 */
class RefreshDto {
  /** 刷新令牌 */
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

/** 微信小程序登录请求体 */
class WechatLoginDto {
  /** 微信登录临时code */
  @IsString()
  @IsNotEmpty()
  code!: string;
}

/** 发送手机验证码请求体 */
class PhoneCodeDto {
  /** 手机号 */
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

/** 切换身份请求体 */
class SwitchIdentityDto {
  /** 目标身份ID */
  @IsUUID()
  @IsNotEmpty()
  identityId!: string;
  /** 目标租户ID，可选 */
  @IsUUID()
  @IsOptional()
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
   * 发送登录短信验证码
   */
  @Post('auth/sms')
  @HttpCode(200)
  async sendSms(@Body() dto: SmsDto) {
    await this.auth.sendPhoneCode(dto.phone);
    return { ok: true };
  }

  /**
   * 使用手机号登录（密码或短信验证码）
   */
  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    let user;
    if (dto.password) {
      user = await this.auth.validatePhonePassword(dto.phone, dto.password); // 校验手机号密码
    } else if (dto.code) {
      user = await this.auth.loginWithPhoneCode(dto.phone, dto.code); // 使用短信验证码登录或注册
    } else {
      throw new BadRequestException('password or code is required');
    }
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
   * 发送手机验证码
   */
  @Post('auth/send-phone-code')
  async sendPhoneCode(@Body() dto: PhoneCodeDto) {
    await this.auth.sendPhoneCode(dto.phone);
    return { ok: true };
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
