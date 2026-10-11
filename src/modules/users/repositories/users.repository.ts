import { EntityRepository, ILike, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import { User, UserState } from '@modules/users/entities/users.entity';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { SignUpArgs } from '@modules/accounts/args/sign-up.args';
import { DateTime } from 'luxon';

@EntityRepository(User)
export class UsersRepository extends BasicRepository<User> {
  static readonly OFFLINE_TIME_IN_SECONDS = 120;
  getUserByEmailOrUsername(email: string | undefined): Promise<User | undefined> {
    if (!email) return Promise.resolve(undefined);

    return this.findOne({
      select: ['id', 'username', 'email', 'salt', 'hash'],
      where: [{ username: ILike(email.toLowerCase()) }, { email: ILike(email.toLowerCase()) }],
    });
  }

  getUserByEmailAndUsername(email: string | undefined, username?: string | undefined): Promise<User | undefined> {
    if (!email) return Promise.resolve(undefined);

    return this.findOne({
      where: [
        { username: username ? ILike(username) : undefined },
        { email: email },
        { username: email },
        { email: username ? ILike(username) : undefined },
      ],
    });
  }

  async createNewUser(input: SignUpArgs & { salt: string; hash: string }): Promise<User> {
    const user: User | undefined = this.create({
      email: input.email,
      username: input.username || undefined,
      salt: input.salt,
      hash: input.hash,
    });
    return this.saveAndReturn(user);
  }

  async findOnline(seconds = 120): Promise<Record<'online' | 'offline', User[]>> {
    const timestamp = DateTime.utc().minus({ seconds }).toSQL();

    return await this.manager.transaction(async (entityManager) => {
      const online = await entityManager.find(User, {
        where: { wasOnlineAt: MoreThan(timestamp) },
        order: { username: 'ASC' },
      });
      let offline = await entityManager.find(User, {
        where: {
          wasOnlineAt: LessThanOrEqual(timestamp),
          state: Not(UserState.OFFLINE),
        },
      });

      offline = offline.map((user) => {
        user.state = UserState.OFFLINE;
        return user;
      });
      await entityManager.save(offline);

      return { online, offline };
    });
  }

  async search(query: string): Promise<User[]> {
    if (query.length > 0) {
      return this.find({
        where: { username: ILike(`%${query}%`) },
        take: 10,
      });
    }

    return this.find({
      take: 10,
    });
  }
}
