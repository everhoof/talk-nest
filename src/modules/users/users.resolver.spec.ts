import { UsersService } from './users.service';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolver } from './users.resolver';

describe('UsersResolver', () => {
  let resolver: UsersResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersResolver, { provide: 'PUB_SUB', useValue: {} }, { provide: UsersService, useValue: {} }],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
