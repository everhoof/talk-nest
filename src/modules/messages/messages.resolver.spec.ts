import { MessagesService } from './messages.service';
import { Test, TestingModule } from '@nestjs/testing';
import { MessagesResolver } from './messages.resolver';

describe('MessagesResolver', () => {
  let resolver: MessagesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesResolver, { provide: 'PUB_SUB', useValue: {} }, { provide: MessagesService, useValue: {} }],
    }).compile();

    resolver = module.get<MessagesResolver>(MessagesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
