import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { Picture } from '@modules/pictures/entities/pictures.entity';

@Injectable()
export class PicturesRepository extends BasicRepository<Picture> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(Picture, manager);
  }
}
