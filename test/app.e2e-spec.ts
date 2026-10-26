import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { buildSchema, findBreakingChanges } from 'graphql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import supertest from 'supertest';
import WebSocket from 'ws';
import { AppModule } from '../src/app.module';
import { databaseOptions } from '../src/database/options';
import { Service } from '../src/tokens';
import { DonationAlertsService } from '../src/modules/donation-alerts/donation-alerts.service';
import { UsersRepository } from '../src/modules/users/repositories/users.repository';
import { RolesRepository } from '../src/modules/roles/repositories/roles.repository';
import { Picture } from '../src/modules/pictures/entities/pictures.entity';
import { PictureRepresentation } from '../src/modules/pictures/entities/picture-representations.entity';

// The setup file requires a separate database before AppModule can be imported.
describe('API on the upgraded framework', () => {
  let app: INestApplication;
  let token: string;
  let userId: number;
  let messageId: number;
  const sockets: WebSocket[] = [];

  const query = (source: string, authenticated = false) => {
    const request = supertest(app.getHttpServer()).post('/graphql').send({ query: source });
    return authenticated ? request.set('Authorization', `Bearer ${token}`) : request;
  };

  beforeAll(async () => {
    const database = new DataSource({ ...databaseOptions(), migrationsRun: false });
    await database.initialize();
    try {
      await database.dropDatabase();
    } finally {
      await database.destroy();
    }
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Service.CONFIG)
      .useValue({
        PUBLIC_URL: 'https://example.invalid',
        CDN_URL: 'https://cdn.example.invalid/',
        DISCORD_API_VERSION: 8,
        DISCORD_API_TOKEN: 'test',
        UPLOAD_QUEUE_LIMIT: 16,
        UPLOAD_ALLOWED_MIMES: ['image/png', 'image/jpeg'],
        UPLOAD_MIN_WIDTH: 10,
        UPLOAD_MIN_HEIGHT: 10,
        UPLOAD_MAX_WIDTH: 9000,
        UPLOAD_MAX_HEIGHT: 9000,
      })
      .overrideProvider(DonationAlertsService)
      .useValue({})
      .overrideProvider(MailerService)
      .useValue({ sendMail: jest.fn().mockResolvedValue(undefined) })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.listen(0, '127.0.0.1');

    const seeds = new DataSource(databaseOptions(true));
    await seeds.initialize();
    try {
      await seeds.runMigrations();
    } finally {
      await seeds.destroy();
    }
  });

  afterAll(async () => {
    for (const socket of sockets) socket.terminate();
    await app?.close();
  });

  it('runs migrations and serves GraphQL over Express 5', async () => {
    expect(await app.get(DataSource).showMigrations()).toBe(false);
    const response = await query('{ getHello }');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { getHello: 'Hello World!' } });
  });

  it('preserves the existing public GraphQL schema', () => {
    const previous = buildSchema(readFileSync(join(process.cwd(), 'graphql/schema.graphql'), 'utf8'));
    expect(findBreakingChanges(previous, app.get(GraphQLSchemaHost).schema)).toEqual([]);
  });

  it('registers, signs in, and authenticates an account', async () => {
    const response = await query(
      'mutation { signUp(username: "UpgradeListener", email: "upgrade@example.invalid", password: "password123") { id username } }',
    );
    expect(response.body.errors).toBeUndefined();
    userId = response.body.data.signUp.id;
    const users = app.get(UsersRepository);
    await users.update(userId, { emailConfirmed: true });
    const login = await query(
      'mutation { signIn(email: "upgrade@example.invalid", password: "password123") { value } }',
    );
    expect(login.body.errors).toBeUndefined();
    token = login.body.data.signIn.value;
    const current = await query('{ getCurrentUser { id username } }', true);
    expect(current.body.data.getCurrentUser).toEqual({ id: userId, username: 'UpgradeListener' });
  });

  it('preserves localized GraphQL error details', async () => {
    const response = await supertest(app.getHttpServer()).post('/graphql?lang=ru').send({
      query: 'mutation { signIn(email: "upgrade@example.invalid", password: "incorrect") { value } }',
    });
    expect(response.body.errors[0].extensions.exception.response).toMatchObject({
      statusCode: 401,
      error: 'WRONG_CREDENTIALS',
      lang: 'ru',
      message: expect.any(String),
    });
    expect(response.body.data).toBeNull();
  });

  it('preserves authentication errors for existing clients', async () => {
    const response = await query('{ getCurrentUser { id } }');
    expect(response.body.errors[0].extensions.exception.response.statusCode).toBe(401);
  });

  it('creates and reads a message through request-scoped loaders', async () => {
    const response = await query(
      'mutation { createMessage(content: "<p>Framework upgrade</p>", pictures: []) { id owner { id username } pictures { id } } }',
      true,
    );
    expect(response.body.errors).toBeUndefined();
    const message = response.body.data.createMessage;
    messageId = message.id;
    expect(message.owner).toEqual({ id: userId, username: 'UpgradeListener' });
    const messages = await query('{ getMessages(count: 10) { id owner { id username } } }');
    expect(messages.body.errors).toBeUndefined();
    expect(messages.body.data.getMessages).toContainEqual({
      id: messageId,
      owner: { id: userId, username: 'UpgradeListener' },
    });
  });

  it('resolves picture representations without losing CDN URLs', async () => {
    const source = app.get(DataSource);
    const representations = await source.getRepository(PictureRepresentation).save(
      ['s', 'm', 'o'].map((size) => ({
        path: `upgrade/${size}.png`,
        width: 64,
        height: 64,
        size: 100,
      })),
    );
    const picture = await source
      .getRepository(Picture)
      .save({ ownerId: userId, sId: representations[0].id, mId: representations[1].id, oId: representations[2].id });
    const response = await query(
      `{ getPictureById(pictureId: ${picture.id}) { id s { link } m { link } o { link } } }`,
    );
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.getPictureById.s.link).toBe('https://cdn.example.invalid/upgrade/s.png');
  });

  it('creates, votes on, and closes a poll using transactional repositories', async () => {
    const users = app.get(UsersRepository);
    const role = await app.get(RolesRepository).findOneByOrFail({ name: 'MODERATOR' });
    const user = await users.findOneByOrFail({ id: userId });
    user.roles = [role];
    await users.save(user);
    const created = await query(
      'mutation { createPoll(question: "Music?", options: ["Jazz", "Rock"], allowChangeVote: true) { id poll { options { id } } } }',
      true,
    );
    expect(created.body.errors).toBeUndefined();
    const poll = created.body.data.createPoll;
    const voted = await query(
      `mutation { votePoll(messageId: ${poll.id}, optionIds: [${poll.poll.options[0].id}]) { totalVotes selectedOptionIds } }`,
      true,
    );
    expect(voted.body.errors).toBeUndefined();
    expect(voted.body.data.votePoll.totalVotes).toBe(1);
    const closed = await query(`mutation { closePoll(messageId: ${poll.id}) { isClosed } }`, true);
    expect(closed.body.errors).toBeUndefined();
    expect(closed.body.data.closePoll.isClosed).toBe(true);
  });

  it('handles authenticated multipart uploads on Express 5', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/upload/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('invalid image data'), { filename: 'invalid.png', contentType: 'image/png' });
    expect(response.status).toBe(415);
  });

  it('keeps existing WebSocket clients authenticated and receives subscription events', async () => {
    const address = app.getHttpServer().address();
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/graphql?lang=en`, 'graphql-ws');
    sockets.push(socket);
    const event = new Promise<any>((resolve, reject) => {
      socket.on('error', reject);
      socket.on('open', () =>
        socket.send(JSON.stringify({ type: 'connection_init', payload: { Authorization: `Bearer ${token}` } })),
      );
      socket.on('message', async (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'connection_ack') {
          socket.send(
            JSON.stringify({
              id: '1',
              type: 'start',
              payload: { query: 'subscription { messageCreated { id owner { id username } } }' },
            }),
          );
          // A query on the same connection confirms the subscription start was processed first.
          socket.send(JSON.stringify({ id: 'ready', type: 'start', payload: { query: '{ getCurrentUser { id } }' } }));
        } else if (message.type === 'data' && message.id === 'ready') {
          if (message.payload.errors) return reject(new Error(JSON.stringify(message.payload.errors)));
          if (message.payload.data.getCurrentUser.id !== userId) return reject(new Error('WebSocket auth failed'));
          const created = await query(
            'mutation { createMessage(content: "<p>Live update</p>", pictures: []) { id } }',
            true,
          );
          if (created.body.errors) reject(new Error(JSON.stringify(created.body.errors)));
        } else if (message.type === 'data' && message.id === '1') {
          resolve(message.payload);
        } else if (message.type === 'error' || message.type === 'connection_error') {
          reject(new Error(JSON.stringify(message)));
        }
      });
    });
    const result = await event;
    expect(result.errors).toBeUndefined();
    expect(result.data.messageCreated.owner).toEqual({ id: userId, username: 'UpgradeListener' });
    socket.close();
  });

  it('refreshes loader-backed user fields between events on the same subscription', async () => {
    const users = app.get(UsersRepository);
    const original = await users.findOneByOrFail({ id: userId });
    const updatedName = 'RenamedSubscriptionListener';
    const eventIds = ['loader-cache-first', 'loader-cache-second'];
    const received: { id: number; username: string }[] = [];
    const address = app.getHttpServer().address();
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/graphql`, 'graphql-ws');
    sockets.push(socket);
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const publish = async (randomId: string) => {
      const response = await query(
        `mutation { createMessage(content: "<p>Loader cache regression</p>", pictures: [], randomId: "${randomId}") { id } }`,
        true,
      );
      if (response.body.errors) throw new Error(JSON.stringify(response.body.errors));
    };

    try {
      await new Promise<void>((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Timed out waiting for subscription cache regression events')),
          10000,
        );
        socket.on('error', reject);
        socket.on('open', () =>
          socket.send(JSON.stringify({ type: 'connection_init', payload: { Authorization: `Bearer ${token}` } })),
        );
        socket.on('message', (raw) => {
          void (async () => {
            const message = JSON.parse(raw.toString());
            if (message.type === 'connection_ack') {
              socket.send(
                JSON.stringify({
                  id: 'events',
                  type: 'start',
                  payload: { query: 'subscription { messageCreated { randomId owner { id username } } }' },
                }),
              );
              socket.send(
                JSON.stringify({ id: 'ready', type: 'start', payload: { query: '{ getCurrentUser { id } }' } }),
              );
            } else if (message.type === 'data') {
              if (message.payload.errors) throw new Error(JSON.stringify(message.payload.errors));
              if (message.id === 'ready') {
                await publish(eventIds[0]);
              } else if (message.id === 'events' && eventIds.includes(message.payload.data.messageCreated.randomId)) {
                received.push(message.payload.data.messageCreated.owner);
                if (received.length === 1) {
                  await users.update(userId, { username: updatedName });
                  await publish(eventIds[1]);
                } else {
                  resolve();
                }
              }
            } else if (message.type === 'error' || message.type === 'connection_error') {
              throw new Error(JSON.stringify(message));
            }
          })().catch(reject);
        });
      });

      expect(received).toEqual([
        { id: userId, username: original.username },
        { id: userId, username: updatedName },
      ]);
    } finally {
      clearTimeout(timeout);
      socket.terminate();
      await users.update(userId, { username: original.username });
    }
  });
});
