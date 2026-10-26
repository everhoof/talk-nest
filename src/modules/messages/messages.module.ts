import { Module } from '@nestjs/common';
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
import { PollsRepository } from './repositories/polls.repository';

@Module({
  imports: [AccountsModule, UploadModule],
  providers: [
    MessagesRepository,
    PicturesRepository,
    PunishmentsRepository,
    UsersRepository,
    PollVotesRepository,
    PollsRepository,
    MessagesService,
    MessagesResolver,
    PollsService,
    PollsResolver,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
