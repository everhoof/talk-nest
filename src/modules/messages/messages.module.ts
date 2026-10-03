import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesRepository } from '@modules/messages/repositories/messages.repository';
import { MessagesService } from '@modules/messages/messages.service';
import { MessagesResolver } from '@modules/messages/messages.resolver';
import { PicturesRepository } from '@modules/pictures/repositories/pictures.repository';
import { AccountsModule } from '@modules/accounts/accounts.module';
import { UploadModule } from '@modules/upload/upload.module';
import { PunishmentsRepository } from '@modules/users/repositories/punishments.repository';
import { UsersRepository } from '@modules/users/repositories/users.repository';
import { PollsService } from './polls.service';
import { PollsResolver } from './polls.resolver';
import { PollVotesRepository } from './repositories/poll-votes.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessagesRepository,
      PicturesRepository,
      PunishmentsRepository,
      UsersRepository,
      PollVotesRepository,
    ]),
    AccountsModule,
    UploadModule,
  ],
  providers: [MessagesService, MessagesResolver, PollsService, PollsResolver],
  exports: [MessagesService],
})
export class MessagesModule {}
