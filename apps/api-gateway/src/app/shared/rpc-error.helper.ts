import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Convertit une erreur RpcException (microservice TCP) en HttpException.
 * L'auth-service utilise RpcException({ statusCode, message, error })
 * donc le format est garanti.
 */
export function throwRpcError(error: unknown): never {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Format RpcException : { statusCode, message, error }
    if (typeof err['statusCode'] === 'number' && err['message']) {
      throw new HttpException(
        { message: err['message'], error: err['error'] },
        err['statusCode'] as number,
      );
    }
  }

  // Fallback
  throw new HttpException(
    { message: 'Une erreur interne est survenue' },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
