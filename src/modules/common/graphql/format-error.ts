import { HttpException } from '@nestjs/common';
import { unwrapResolverError } from '@apollo/server/errors';
import { GraphQLFormattedError } from 'graphql';

// Existing clients read translated errors and auth status from Apollo 2's response shape.
// TODO: Update frontend notifications and logout handling to consume Apollo's current
// error extensions, then remove this legacy response adapter. Keep HTTP and WebSocket
// error contracts aligned so both transports retain translated errors and auth status.
export function formatGraphqlError(formatted: GraphQLFormattedError, error?: unknown): GraphQLFormattedError {
  const exception = error ? unwrapResolverError(error) : undefined;
  const response = exception instanceof HttpException ? exception.getResponse() : formatted.extensions?.originalError;
  if (!response) return formatted;
  return {
    ...formatted,
    extensions: { ...formatted.extensions, exception: { response } },
  };
}
