import {
  createDatabase,
  createLocalDatabase,
  FilesystemBridge,
} from '@tinacms/datalayer';
import { MongodbLevel } from 'mongodb-level';
import { GitHubProvider } from 'tinacms-gitprovider-github';
import fs from 'fs';
import path from 'path';

// Build-time JSON imports — bundled by webpack/turbopack, works on Vercel serverless.
import graphqlSchema from './__generated__/_graphql.json';
import schemaData from './__generated__/_schema.json';
import lookup from './__generated__/_lookup.json';

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === 'true';
const contentRoot = resolveContentRoot();

function resolveContentRoot(): string {
  const envRoot = process.env.TINA_CONTENT_ROOT;
  if (envRoot) return envRoot;

  const appRootCandidate = path.join(process.cwd(), 'apps', 'web');
  if (fs.existsSync(path.join(appRootCandidate, 'content'))) {
    return appRootCandidate;
  }

  return process.cwd();
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required Tina environment variable: ${name}`);
  }

  return value;
}

function logInfo(message: string, context: Record<string, unknown>) {
  console.info(`[tina] ${message}`, context);
}

/**
 * Read-only bridge for Vercel serverless.
 *
 * Reads content from the deployment bundle (for indexing), but no-ops on
 * write/delete since the Vercel filesystem is read-only. Persistence is
 * handled by GitHubProvider.onPut which commits directly to GitHub.
 */
class ServerlessBridge extends FilesystemBridge {
  async put(): Promise<void> {
    // no-op: Vercel deployment filesystem is read-only.
    // GitHubProvider.onPut handles persisting to GitHub.
  }

  async delete(): Promise<void> {
    // no-op: Vercel deployment filesystem is read-only.
    // GitHubProvider.onDelete handles persisting to GitHub.
  }
}

const branch =
  process.env.GITHUB_BRANCH || process.env.TINA_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';

logInfo('database.init', {
  mode: isLocal ? 'local' : 'remote',
  contentRoot,
  branch,
  hasMongoUri: Boolean(process.env.MONGODB_URI),
  hasGitHubToken: Boolean(process.env.GITHUB_PERSONAL_ACCESS_TOKEN),
});

const database = isLocal
  ? createLocalDatabase({
      rootPath: contentRoot,
    })
  : createDatabase({
      bridge: new ServerlessBridge(contentRoot),
      gitProvider: new GitHubProvider({
        branch,
        owner: getRequiredEnv('GITHUB_OWNER'),
        repo: getRequiredEnv('GITHUB_REPO'),
        token: getRequiredEnv('GITHUB_PERSONAL_ACCESS_TOKEN'),
        // Monorepo content lives under apps/web/content/* in GitHub.
        rootPath: 'apps/web',
      }),
      databaseAdapter: new MongodbLevel<string, Record<string, unknown>>({
        collectionName: 'tinacms',
        dbName: 'tinacms',
        mongoUri: getRequiredEnv('MONGODB_URI'),
      }),
      namespace: branch,
    });

// Auto-index content into MongoDB on first query (production mode only).
// Uses VERCEL_GIT_COMMIT_SHA to skip re-indexing when the deployment hasn't changed.
if (!isLocal) {
  let indexed = false;
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const versionKey = `__tina_indexed_sha__${branch}`;
  const originalGetGraphQLSchema = database.getGraphQLSchema.bind(database);

  database.getGraphQLSchema = async function () {
    if (!indexed) {
      indexed = true;
      try {
        // Check if MongoDB already has content indexed for this deployment
        let needsIndex = true;
        if (deploymentSha) {
          try {
            const adapter = new MongodbLevel<string, Record<string, unknown>>({
              collectionName: 'tinacms',
              dbName: 'tinacms',
              mongoUri: getRequiredEnv('MONGODB_URI'),
            });
            const stored = await adapter.get(versionKey);
            if (stored && (stored as Record<string, unknown>).sha === deploymentSha) {
              logInfo('database.index.skip', {
                reason: 'deployment SHA unchanged',
                sha: deploymentSha,
              });
              needsIndex = false;
            }
            await adapter.close();
          } catch {
            // Key not found or connection issue — proceed with indexing
          }
        }

        if (needsIndex) {
          const start = Date.now();
          logInfo('database.index.start', { contentRoot, sha: deploymentSha });
          await database.indexContent({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            graphQLSchema: graphqlSchema as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tinaSchema: { schema: schemaData } as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lookup: lookup as any,
          });
          const elapsed = Date.now() - start;
          logInfo('database.index.finish', { contentRoot, elapsed: `${elapsed}ms` });

          // Store deployment SHA so subsequent cold starts skip indexing
          if (deploymentSha) {
            try {
              const adapter = new MongodbLevel<string, Record<string, unknown>>({
                collectionName: 'tinacms',
                dbName: 'tinacms',
                mongoUri: getRequiredEnv('MONGODB_URI'),
              });
              await adapter.put(versionKey, { sha: deploymentSha });
              await adapter.close();
            } catch (e) {
              console.warn('[tina] failed to store deployment SHA', e);
            }
          }
        }
      } catch (e) {
        indexed = false;
        console.error('[tina] database.index.error', e);
        throw e;
      }
    }
    return originalGetGraphQLSchema();
  };
}

export default database;
