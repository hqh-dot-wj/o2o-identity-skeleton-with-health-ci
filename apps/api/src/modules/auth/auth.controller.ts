import { BadRequestException, Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdentityService } from '../identity/identity.service';

class LoginDto {
  email!: string;
  password!: string;
  identityId?: string;
  tenantId?: string;
}

class RefreshDto {
  refreshToken!: string;
}

class SwitchIdentityDto {
  identityId!: string;
  tenantId?: string;
}

class LoginPhoneDto {
  phone!: string;
  password?: string;
  code?: string;
  identityId?: string;
  tenantId?: string;
}

class WechatLoginDto {
  code!: string;
  phone!: string;
  identityId?: string;
  tenantId?: string;
}

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly identity: IdentityService) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    const accessToken = await this.auth.issueAccess(user.id, dto.identityId, dto.tenantId);
    const refreshToken = await this.auth.issueRefresh(user.id);
    const identities = await this.identity.listUserIdentities(user.id);
    return { accessToken, refreshToken, identities };
  }

  @Post('auth/login-phone')
  @HttpCode(200)
  async loginPhone(@Body() dto: LoginPhoneDto) {
    let user;
    if (dto.password) {
      user = await this.auth.validatePhonePassword(dto.phone, dto.password);
    } else if (dto.code) {
      user = await this.auth.validatePhoneCode(dto.phone, dto.code);
    } else {
      throw new BadRequestException('password or code required');
    }
    const accessToken = await this.auth.issueAccess(user.id, dto.identityId, dto.tenantId);
    const refreshToken = await this.auth.issueRefresh(user.id);
    const identities = await this.identity.listUserIdentities(user.id);
    return { accessToken, refreshToken, identities };
  }

  @Post('auth/login-wechat')
  @HttpCode(200)
  async loginWechat(@Body() dto: WechatLoginDto) {
    const user = await this.auth.loginWithWechat(dto.code, dto.phone);
    const accessToken = await this.auth.issueAccess(user.id, dto.identityId, dto.tenantId);
    const refreshToken = await this.auth.issueRefresh(user.id);
    const identities = await this.identity.listUserIdentities(user.id);
    return { accessToken, refreshToken, identities };
  }

  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    const userId = await this.auth.verifyRefresh(dto.refreshToken);
    const accessToken = await this.auth.issueAccess(userId);
    return { accessToken };
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.revokeRefresh(dto.refreshToken);
    return { success: true };
  }

  @UseGuards(JwtAccessGuard)
  @Post('auth/switch-identity')
  async switchIdentity(@CurrentUser() user: any, @Body() dto: SwitchIdentityDto) {
    const accessToken = await this.auth.issueAccess(user.sub, dto.identityId, dto.tenantId);
    return { accessToken };
  }

  @UseGuards(JwtAccessGuard)
  @Get('me')
  async me(@CurrentUser() user: any) {
    const profile = await this.identity.getProfile(user.sub);
    return { claims: user, profile };
  }
}
