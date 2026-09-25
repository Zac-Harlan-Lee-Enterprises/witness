import type { AuthProvider, SyncProvider } from '@/application/ports';

/**
 * Local-only defaults. Future cloud sync (Cognito + API Gateway + Lambda +
 * DynamoDB/S3, see docs/future-aws.md) plugs in behind these interfaces
 * without changing gameplay code. Nothing here makes a network request.
 */
export class LocalOnlySync implements SyncProvider {
  readonly enabled = false;
  async push(): Promise<void> {}
  async pull(): Promise<never[]> {
    return [];
  }
}

export class LocalOnlyAuth implements AuthProvider {
  readonly mode = 'local-only' as const;
  async currentUserId(): Promise<null> {
    return null;
  }
}
