import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * JWT 访问令牌守卫，校验请求头中的 Bearer Token
 */
@Injectable()
export class JwtAccessGuard implements CanActivate {
  /** 注入 JWT 服务 */
  constructor(private readonly jwt: JwtService) {}

  /**
   * 验证访问令牌并将载荷附加到请求对象
   */
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest(); // 获取当前请求
    const auth = req.headers['authorization'] as string | undefined; // 解析 Authorization 头
    if (!auth || !auth.startsWith('Bearer ')) throw new UnauthorizedException('Missing token'); // 检查是否携带令牌
    const token = auth.slice(7); // 提取 JWT
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET }); // 校验并解析令牌
      req.user = payload; // 将声明挂载到请求对象
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token'); // 令牌无效
    }
  }
}
