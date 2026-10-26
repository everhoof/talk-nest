import { Module } from '@nestjs/common';
import { UsersRepository } from '@modules/users/repositories/users.repository';
import { UsersService } from '@modules/users/users.service';
import { UsersResolver } from '@modules/users/users.resolver';
import { UsersLoader } from '@modules/users/loaders/users.loader';
import { PunishmentsRepository } from '@modules/users/repositories/punishments.repository';
import { TokensRepository } from '@modules/accounts/repositories/tokens.repository';
import { MessagesModule } from '@modules/messages/messages.module';
import { PicturesRepository } from '@modules/pictures/repositories/pictures.repository';
import { PunishmentsLoader } from '@modules/users/loaders/punishments.loader';

@Module({
  imports: [MessagesModule],
  providers: [
    UsersRepository,
    TokensRepository,
    PunishmentsRepository,
    PicturesRepository,
    UsersService,
    UsersResolver,
    UsersLoader,
    PunishmentsLoader,
  ],
})
export class UsersModule {}
