import { readFileSync } from 'fs';
import { join } from 'path';
import { buildSchema, defaultFieldResolver, graphql } from 'graphql';
import { User } from '@modules/users/entities/users.entity';
import { Message, MessageType } from './entities/messages.entity';
import { PollsResolver } from './polls.resolver';
import { PollsService } from './polls.service';

describe('PollsResolver without an API or database', () => {
  const polls = {
    getPoll: jest.fn(),
  };
  const resolver = new PollsResolver((polls as unknown) as PollsService);
  const schema = buildSchema(readFileSync(join(process.cwd(), 'graphql/schema.graphql'), 'utf8'));
  const message = Object.assign(new Message(), {
    id: 10,
    type: MessageType.POLL,
    deletedAt: null,
  });
  const user = Object.assign(new User(), {
    id: 2,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    polls.getPoll.mockImplementation(async (messageId, viewer) => {
      const poll = {
        messageId,
        question: 'Music?',
        selectedOptionIds: [],
        totalVotes: null,
      };

      if (viewer?.id === user.id) {
        return {
          ...poll,
          selectedOptionIds: [11],
          totalVotes: 3,
        };
      }

      return poll;
    });
  });

  it.each([MessageType.GENERAL, MessageType.SYSTEM])('skips poll data for message type %s', async (type) => {
    const ordinaryMessage = Object.assign(new Message(), {
      type,
    });

    await expect(resolver.poll(ordinaryMessage, user)).resolves.toBeNull();
    expect(polls.getPoll).not.toHaveBeenCalled();
  });

  it('skips deleted polls', async () => {
    const deletedMessage = Object.assign(new Message(), {
      ...message,
      deletedAt: new Date(),
    });

    await expect(resolver.poll(deletedMessage, user)).resolves.toBeNull();
    expect(polls.getPoll).not.toHaveBeenCalled();
  });

  it.each([undefined, user])('includes viewer-specific polls in the message list', async (viewer) => {
    const result = await graphql({
      schema,
      source: '{ getMessages { id poll { messageId question selectedOptionIds totalVotes } } }',
      rootValue: {
        getMessages: () => [message],
      },
      fieldResolver: (source, args, context, info) => {
        if (info.parentType.name === 'Message' && info.fieldName === 'poll') {
          return resolver.poll(source, viewer);
        }

        return defaultFieldResolver(source, args, context, info);
      },
    });

    expect(result.errors).toBeUndefined();
    expect(polls.getPoll).toHaveBeenCalledWith(message.id, viewer);
    expect(result.data?.getMessages).toEqual([
      {
        id: message.id,
        poll: await polls.getPoll(message.id, viewer),
      },
    ]);
    expect(message).not.toHaveProperty('poll');
  });
});
