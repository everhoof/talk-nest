import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { formatGraphqlError } from './format-error';

// Existing chat clients use the graphql-ws subprotocol from subscriptions-transport-ws.
// Nest 12 no longer installs this transport, so manage its lifecycle explicitly.
// TODO: Migrate frontend clients to graphql-ws (the graphql-transport-ws protocol),
// then use Nest's subscriptions['graphql-ws'] integration and remove this service.
// Preserve connection authentication and reconnect behavior during that migration.
@Injectable()
export class SubscriptionsService implements OnApplicationBootstrap, OnModuleDestroy {
  private server?: SubscriptionServer;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly schemaHost: GraphQLSchemaHost,
  ) {}

  onApplicationBootstrap(): void {
    this.server = SubscriptionServer.create(
      {
        schema: this.schemaHost.schema,
        execute,
        subscribe,
        onOperation: (_message, params) => ({
          ...params,
          formatResponse: (result) => ({
            ...result,
            ...(result.errors
              ? { errors: result.errors.map((error) => formatGraphqlError(error.toJSON(), error)) }
              : {}),
          }),
        }),
        onConnect: (params, _socket, { request }) => ({
          req: {
            headers: { ...request.headers, authorization: params?.Authorization || params?.authorization },
            query: Object.fromEntries(new URL(request.url || '/graphql', 'http://localhost').searchParams),
          },
        }),
      },
      { server: this.adapterHost.httpAdapter.getHttpServer(), path: '/graphql' },
    );
  }

  onModuleDestroy(): void {
    this.server?.server.clients.forEach((socket) => socket.terminate());
    this.server?.close();
  }
}
