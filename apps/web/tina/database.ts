import {
  createDatabase,
  createLocalDatabase,
} from '@tinacms/datalayer';
import { MongodbLevel } from 'mongodb-level';
import { GitHubProvider } from 'tinacms-gitprovider-github';

// Build-time JSON imports — bundled by webpack/turbopack, works on Vercel serverless.
import graphqlSchema from './__generated__/_graphql.json';
import schemaData from './__generated__/_schema.json';
import lookup from './__generated__/_lookup.json';

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === 'true';

const database = isLocal
  ? createLocalDatabase()
  : createDatabase({
      gitProvider: new GitHubProvider({
        branch: process.env.GITHUB_BRANCH || 'main',
        owner: process.env.GITHUB_OWNER || '',
        repo: process.env.GITHUB_REPO || '',
        token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '',
      }),
      databaseAdapter: new MongodbLevel<string, Record<string, unknown>>({
        collectionName: 'tinacms',
        dbName: 'tinacms',
        mongoUri: process.env.MONGODB_URI || '',
      }),
      namespace: process.env.GITHUB_BRANCH || 'main',
    });

// Auto-index content into MongoDB on first query (production mode only).
if (!isLocal) {
  let indexed = false;
  const originalGetGraphQLSchema = database.getGraphQLSchema.bind(database);
  database.getGraphQLSchema = async function () {
    if (!indexed) {
      indexed = true;
      try {
        await database.indexContent({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          graphQLSchema: graphqlSchema as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tinaSchema: { schema: schemaData } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lookup: lookup as any,
        });
      } catch (e) {
        indexed = false;
        throw e;
      }
    }
    return originalGetGraphQLSchema();
  };
}

export default database;
