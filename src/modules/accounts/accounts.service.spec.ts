import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { AccountsService } from './accounts.service';
import { TokensRepository } from './repositories/tokens.repository';
import { ConfirmationsRepository } from './repositories/confirmations.repository';
import { OAuthRepository } from './repositories/oauth.repository';
import { UsersRepository } from '@modules/users/repositories/users.repository';
import { RolesRepository } from '@modules/roles/repositories/roles.repository';
import { User } from '@modules/users/entities/users.entity';
import { Token } from './entities/tokens.entity';
import { UnauthorizedException } from '@modules/common/exceptions/exceptions';
import { Service } from '../../tokens';

// Unit tests use repository doubles; integration tests exercise a separate database.
describe('AccountsService', () => {
  let service: AccountsService;
  const users = {
    getUserByEmailAndUsername: jest.fn(),
    getUserByEmailOrUsername: jest.fn(),
    createNewUser: jest.fn(),
    saveAndReturn: jest.fn(),
  };
  const tokens = { createNewToken: jest.fn() };
  const roles = { getDefaultRole: jest.fn() };
  const confirmations = { createNewConfirmation: jest.fn() };
  const mailer = { sendMail: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: Service.CONFIG, useValue: { PUBLIC_URL: 'https://example.invalid' } },
        { provide: EventEmitter2, useValue: new EventEmitter2() },
        { provide: getDataSourceToken(), useValue: {} },
        { provide: UsersRepository, useValue: users },
        { provide: TokensRepository, useValue: tokens },
        { provide: RolesRepository, useValue: roles },
        { provide: ConfirmationsRepository, useValue: confirmations },
        { provide: OAuthRepository, useValue: {} },
        { provide: MailerService, useValue: mailer },
        { provide: 'PUB_SUB', useValue: { publish: jest.fn() } },
      ],
    }).compile();
    service = module.get(AccountsService);
  });

  it('registers a user with a hashed password and the default role', async () => {
    const input = { username: 'Listener_123', email: 'listener@example.invalid', password: 'password' };
    users.getUserByEmailAndUsername.mockResolvedValue(null);
    users.createNewUser.mockImplementation(async (value) => Object.assign(new User(), value, { id: 1 }));
    users.saveAndReturn.mockImplementation(async (value) => value);
    roles.getDefaultRole.mockResolvedValue({ id: 1, name: 'USER' });
    confirmations.createNewConfirmation.mockResolvedValue({ value: 'confirmation-token' });
    mailer.sendMail.mockResolvedValue(undefined);

    const user = await service.createUser(input);
    expect(user).toMatchObject({ id: 1, username: input.username, email: input.email, roles: [{ name: 'USER' }] });
    expect(service.checkSaltHash(input.password, user.salt!, user.hash!)).toBe(true);
    expect(mailer.sendMail).toHaveBeenCalled();
  });

  it.each(['listener@example.invalid', 'Listener_123'])('authenticates using %s', async (email) => {
    const user = Object.assign(new User(), { id: 1, ...service.createSaltHash('password') });
    const token = Object.assign(new Token(), { id: 2, ownerId: user.id });
    users.getUserByEmailOrUsername.mockResolvedValue(user);
    tokens.createNewToken.mockResolvedValue(token);
    await expect(service.validateUserByEmailAndPassword({ email, password: 'password' })).resolves.toBe(token);
  });

  it.each([null, { id: 1, salt: 'invalid', hash: 'invalid' }])('rejects invalid credentials', async (user) => {
    users.getUserByEmailOrUsername.mockResolvedValue(user);
    await expect(
      service.validateUserByEmailAndPassword({ email: 'invalid', password: 'invalid' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.createNewToken).not.toHaveBeenCalled();
  });
});
