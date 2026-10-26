import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { PictureRepresentation } from '@modules/pictures/entities/picture-representations.entity';
import { BasicRepository } from '@modules/common/repositories/basic.repository';

@Injectable()
export class PictureRepresentationsRepository extends BasicRepository<PictureRepresentation> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(PictureRepresentation, manager);
  }
}
