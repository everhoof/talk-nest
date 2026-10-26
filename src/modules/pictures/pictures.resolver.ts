import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseFilters } from '@nestjs/common';
import { GraphqlExceptionFilter, ThrottlerExceptionFilter } from '@modules/common/filters/http-exception.filter';
import { Picture } from '@modules/pictures/entities/pictures.entity';
import { PicturesService } from '@modules/pictures/pictures.service';
import { PictureRepresentation } from '@modules/pictures/entities/picture-representations.entity';
import { PictureRepresentationsLoader } from '@modules/pictures/loaders/picture-representations.loader';
import DataLoader from 'dataloader';
import { Loader } from '@modules/common/graphql/dataloader';
import { GetPictureByIdArgs } from '@modules/pictures/args/get-picture-by-id.args';
import { UsersLoader } from '@modules/users/loaders/users.loader';
import { User } from '@modules/users/entities/users.entity';

@UseFilters(GraphqlExceptionFilter, ThrottlerExceptionFilter)
@Resolver(() => Picture)
export class PicturesResolver {
  constructor(private readonly picturesService: PicturesService) {}

  @ResolveField(() => User)
  async owner(
    @Parent() picture: Picture,
    @Loader(UsersLoader)
    usersLoader: DataLoader<User['id'], User>,
  ): Promise<Nullable<User>> {
    if (picture.ownerId) {
      return usersLoader.load(picture.ownerId);
    }
    return null;
  }

  @ResolveField(() => PictureRepresentation)
  async s(
    @Parent() picture: Picture,
    @Loader(PictureRepresentationsLoader)
    pictureRepresentationsLoader: DataLoader<PictureRepresentation['id'], PictureRepresentation>,
  ): Promise<PictureRepresentation> {
    return pictureRepresentationsLoader.load(picture.sId);
  }

  @ResolveField(() => PictureRepresentation)
  async m(
    @Parent() picture: Picture,
    @Loader(PictureRepresentationsLoader)
    pictureRepresentationsLoader: DataLoader<PictureRepresentation['id'], PictureRepresentation>,
  ): Promise<PictureRepresentation> {
    return pictureRepresentationsLoader.load(picture.mId);
  }

  @ResolveField(() => PictureRepresentation)
  async o(
    @Parent() picture: Picture,
    @Loader(PictureRepresentationsLoader)
    pictureRepresentationsLoader: DataLoader<PictureRepresentation['id'], PictureRepresentation>,
  ): Promise<PictureRepresentation> {
    return pictureRepresentationsLoader.load(picture.oId);
  }

  @Query(() => Picture)
  getPictureById(@Args() args: GetPictureByIdArgs): Promise<Picture> {
    return this.picturesService.getPictureById(args);
  }
}
