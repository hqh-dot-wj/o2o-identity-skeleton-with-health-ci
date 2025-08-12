import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 参数装饰器，获取当前请求附带的用户声明
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest(); // 获取请求对象
  return req.user; // 返回由守卫挂载的用户信息
});
