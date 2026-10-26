import { Injectable, Scope } from '@nestjs/common';
import { OrderedNestDataLoader } from '@modules/common/graphql/dataloader';
import { PictureRepresentation } from '@modules/pictures/entities/picture-representations.entity';
import { PictureRepresentationsRepository } from '@modules/pictures/repositories/picture-representations.repository';

@Injectable({ scope: Scope.REQUEST })
export class PictureRepresentationsLoader extends OrderedNestDataLoader<
  PictureRepresentation['id'],
  PictureRepresentation
> {
  constructor(private readonly pictureRepresentationsRepository: PictureRepresentationsRepository) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  protected getOptions = () => ({
    query: (keys: Array<PictureRepresentation['id']>) => this.pictureRepresentationsRepository.findByIds(keys),
  });
}
