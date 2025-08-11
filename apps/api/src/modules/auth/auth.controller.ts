import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
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

  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    const userId = await this.auth.verifyRefresh(dto.refreshToken);
    const accessToken = await this.auth.issueAccess(userId);
    return { accessToken };
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
