import { CallHandler, createParamDecorator, ExecutionContext, Injectable, NestInterceptor, Type } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import DataLoader from 'dataloader';
import type { GraphQLResolveInfo } from 'graphql';

const loaderContext = Symbol('graphql-loaders');

// TODO: Create a typed DataLoader registry in GraphQL's per-operation context and
// replace this interceptor/decorator bridge. Preserve batching, result ordering,
// and cache isolation between requests and subscription operations.
@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType<string>() !== 'graphql') return next.handle();
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    if (!ctx[loaderContext]) {
      // Subscription contexts span multiple events, so cached records would become stale.
      const cache = gqlContext.getInfo<GraphQLResolveInfo>().operation.operation !== 'subscription';
      const contextId = ContextIdFactory.create();
      this.moduleRef.registerRequestByContextId(ctx.req, contextId);
      const loaders = new Map<Type<OrderedNestDataLoader<any, any>>, Promise<DataLoader<any, any>>>();
      ctx[loaderContext] = (type: Type<OrderedNestDataLoader<any, any>>) => {
        if (!loaders.has(type)) {
          loaders.set(
            type,
            this.moduleRef
              .resolve(type, contextId, { strict: false })
              .then((loader) => loader.generateDataLoader({ cache })),
          );
        }
        return loaders.get(type);
      };
    }
    return next.handle();
  }
}

export const Loader = createParamDecorator((type: Type<OrderedNestDataLoader<any, any>>, context: ExecutionContext) => {
  return GqlExecutionContext.create(context).getContext()[loaderContext](type);
});

export abstract class OrderedNestDataLoader<Key, Value> {
  protected abstract getOptions(): {
    query: (keys: Key[]) => Promise<Value[]>;
    propertyKey?: string[];
  };

  generateDataLoader({ cache = true }: { cache?: boolean } = {}): DataLoader<Key, Value, Key | string> {
    const { query, propertyKey } = this.getOptions();
    return new DataLoader<Key, Value, Key | string>(
      async (keys) => {
        const values = await query([...keys]);
        return keys.map((key) => {
          const value = values.find((candidate) =>
            propertyKey
              ? propertyKey.every((property) => candidate[property] === key[property])
              : candidate['id'] === key,
          );
          return value ?? new Error(`${this.constructor.name}: record not found`);
        });
      },
      {
        cache,
        ...(propertyKey
          ? { cacheKeyFn: (key: Key) => JSON.stringify(propertyKey.map((property) => key[property])) }
          : {}),
      },
    );
  }
}
