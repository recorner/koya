export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  tls: boolean;
}

export interface LockResult {
  acquired: boolean;
  token: string | null;
}
