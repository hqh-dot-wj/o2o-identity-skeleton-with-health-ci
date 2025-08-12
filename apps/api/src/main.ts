import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

/**
 * 应用入口函数，创建并启动 Nest 应用
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule); // 创建 Nest 应用实例
  app.use(helmet()); // 安全头中间件
  app.enableCors(); // 启用 CORS
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); // 请求体验证

  const port = process.env.PORT || 4000; // 监听端口
  await app.listen(port); // 启动服务
  console.log(`API listening on http://localhost:${port}`); // 输出服务地址
}

bootstrap();
