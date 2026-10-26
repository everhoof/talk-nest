import { Injectable, Scope } from '@nestjs/common';
import { OrderedNestDataLoader } from '@modules/common/graphql/dataloader';
import { UsersRepository } from '../repositories/users.repository';
import { User } from '../entities/users.entity';

@Injectable({ scope: Scope.REQUEST })
export class UsersLoader extends OrderedNestDataLoader<User['id'], User> {
  constructor(private readonly usersRepository: UsersRepository) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  protected getOptions = () => ({
    query: (keys: Array<User['id']>) => this.usersRepository.findByIds(keys),
  });
}
