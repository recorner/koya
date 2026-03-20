/** DI token for BriaClientService */
export const BRIA_CLIENT_SERVICE = 'BRIA_CLIENT_SERVICE';

/** DI token for BriaAdminService */
export const BRIA_ADMIN_SERVICE = 'BRIA_ADMIN_SERVICE';

/** gRPC metadata header for Bria API key */
export const BRIA_API_KEY_HEADER = 'x-bria-api-key';

/** Environment variable names */
export const BRIA_ENV = {
  API_HOST: 'BRIA_API_HOST',
  API_PORT: 'BRIA_API_PORT',
  ADMIN_HOST: 'BRIA_ADMIN_HOST',
  ADMIN_PORT: 'BRIA_ADMIN_PORT',
  API_KEY: 'BRIA_API_KEY',
  ADMIN_API_KEY: 'BRIA_ADMIN_API_KEY',
} as const;

/** Default connection values */
export const BRIA_DEFAULTS = {
  API_HOST: 'localhost',
  API_PORT: 2742,
  ADMIN_HOST: 'localhost',
  ADMIN_PORT: 2743,
  TIMEOUT_MS: 10_000,
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 500,
} as const;

/** Proto file paths relative to the proto/ directory in this library */
export const PROTO_PATHS = {
  API: 'api/bria.proto',
  ADMIN: 'admin/api.proto',
} as const;

/** gRPC package names matching proto definitions */
export const GRPC_PACKAGES = {
  API: 'services.bria.v1',
  ADMIN: 'services.bria_admin.v1',
} as const;
