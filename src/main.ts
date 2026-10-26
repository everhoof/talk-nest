import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import 'global-agent/bootstrap';

async function bootstrap() {
  const PORT = parseInt(process.env.APP_PORT || '', 10);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();
  app.enableShutdownHooks();

  if (process.env.NODE_ENV === 'development' && process.env.UPLOAD_DIR) {
    app.useStaticAssets(join(process.cwd(), process.env.UPLOAD_DIR), {
      prefix: '/cdn/',
    });
  }

  await app.listen(PORT);
}
bootstrap();
