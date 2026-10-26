import { Module } from '@nestjs/common';
import { PicturesRepository } from '@modules/pictures/repositories/pictures.repository';
import { PictureRepresentationsRepository } from '@modules/pictures/repositories/picture-representations.repository';
import { UploadService } from '@modules/upload/upload.service';
import { UploadController } from '@modules/upload/upload.controller';
import { PunishmentsRepository } from '@modules/users/repositories/punishments.repository';

@Module({
  providers: [PicturesRepository, PictureRepresentationsRepository, PunishmentsRepository, UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
