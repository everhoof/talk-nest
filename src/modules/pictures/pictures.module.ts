import { Module } from '@nestjs/common';
import { PicturesRepository } from '@modules/pictures/repositories/pictures.repository';
import { PictureRepresentationsRepository } from '@modules/pictures/repositories/picture-representations.repository';
import { PicturesService } from '@modules/pictures/pictures.service';
import { PicturesResolver } from '@modules/pictures/pictures.resolver';
import { PicturesLoader } from '@modules/pictures/loaders/pictures.loader';
import { PictureRepresentationsLoader } from '@modules/pictures/loaders/picture-representations.loader';

@Module({
  providers: [
    PicturesRepository,
    PictureRepresentationsRepository,
    PicturesService,
    PicturesResolver,
    PicturesLoader,
    PictureRepresentationsLoader,
  ],
})
export class PicturesModule {}
