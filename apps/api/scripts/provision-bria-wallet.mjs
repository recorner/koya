import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const grpcHost = process.env.BRIA_API_HOST || 'localhost';
const grpcPort = Number(process.env.BRIA_API_PORT || '2742');
const adminHost = process.env.BRIA_ADMIN_HOST || grpcHost;
const adminPort = Number(process.env.BRIA_ADMIN_PORT || '2743');

const walletName = process.env.BRIA_WALLET_NAME || 'koya-testnet4';
const payoutQueueName =
  process.env.BRIA_PAYOUT_QUEUE_NAME || process.env.BRIA_PAYOUT_QUEUE || 'koya-payouts';
const serviceProfileName = process.env.BRIA_SERVICE_PROFILE || 'koya-service';
const accountName = process.env.BRIA_ACCOUNT_NAME || 'koya';

const descriptorExternal = process.env.BRIA_WALLET_DESCRIPTOR_EXTERNAL || '';
const descriptorInternal = process.env.BRIA_WALLET_DESCRIPTOR_INTERNAL || '';
const walletXpub = process.env.BRIA_WALLET_XPUB || '';
const walletDerivationPath = process.env.BRIA_WALLET_DERIVATION_PATH || 'm/84h/1h/0h';

if (!walletXpub && (!descriptorExternal || !descriptorInternal)) {
  throw new Error('Missing BRIA_WALLET_DESCRIPTOR_EXTERNAL or BRIA_WALLET_DESCRIPTOR_INTERNAL');
}

function metadataWithApiKey(apiKey, header = 'x-bria-api-key') {
  const md = new grpc.Metadata();
  md.add(header, apiKey);
  return md;
}

function callUnary(client, method, request, metadata) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 15_000);

    const callback = (err, response) => {
      if (err) reject(err);
      else resolve(response);
    };

    if (metadata) {
      client[method](request, metadata, { deadline }, callback);
      return;
    }

    client[method](request, { deadline }, callback);
  });
}

function isAlreadyExists(err) {
  return Boolean(err && typeof err === 'object' && err.code === grpc.status.ALREADY_EXISTS);
}

function isDuplicateConstraint(err) {
  const details = typeof err?.details === 'string' ? err.details : '';
  return err?.code === grpc.status.INTERNAL && /duplicate key value violates unique constraint/i.test(details);
}

function resolveProtoPath(relativePath) {
  const runtimePath = path.join('/proto', relativePath);
  if (fs.existsSync(runtimePath)) return runtimePath;

  return path.join(__dirname, '..', '..', '..', 'libs', 'bria-adapter', 'proto', relativePath);
}

async function createApiClient() {
  const includeDirs = fs.existsSync('/proto')
    ? ['/proto']
    : [path.join(__dirname, '..', '..', '..', 'libs', 'bria-adapter', 'proto')];
  const apiProtoPath = resolveProtoPath(path.join('api', 'bria.proto'));
  const packageDefinition = await protoLoader.load(apiProtoPath, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs,
  });

  const grpcObject = grpc.loadPackageDefinition(packageDefinition);
  const BriaService = grpcObject.services.bria.v1.BriaService;

  return new BriaService(`${grpcHost}:${grpcPort}`, grpc.credentials.createInsecure());
}

async function createAdminClient() {
  const includeDirs = fs.existsSync('/proto')
    ? ['/proto']
    : [path.join(__dirname, '..', '..', '..', 'libs', 'bria-adapter', 'proto')];
  const adminProtoPath = resolveProtoPath(path.join('admin', 'api.proto'));
  const packageDefinition = await protoLoader.load(adminProtoPath, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs,
  });

  const grpcObject = grpc.loadPackageDefinition(packageDefinition);
  const AdminService = grpcObject.services.bria_admin.v1.AdminService;

  return new AdminService(`${adminHost}:${adminPort}`, grpc.credentials.createInsecure());
}

async function main() {
  const apiClient = await createApiClient();
  const adminClient = await createAdminClient();

  let adminApiKey = process.env.BRIA_ADMIN_API_KEY || '';
  let generatedAdminApiKey = '';
  let generatedProfileApiKey = '';

  if (!adminApiKey) {
    const bootstrap = await callUnary(adminClient, 'bootstrap', {}, undefined);
    generatedAdminApiKey = bootstrap.key?.key || '';
    adminApiKey = generatedAdminApiKey;
  }

  if (!adminApiKey) {
    throw new Error('Bria admin API key unavailable after bootstrap');
  }

  const adminMd = metadataWithApiKey(adminApiKey, 'x-bria-admin-api-key');

  let accountApiKey = process.env.BRIA_API_KEY || '';
  const accounts = await callUnary(adminClient, 'listAccounts', {}, adminMd);
  const accountExists = (accounts.accounts || []).some((account) => account.name === accountName);

  if (!accountExists) {
    const account = await callUnary(adminClient, 'createAccount', { name: accountName }, adminMd);
    accountApiKey = account.key?.key || accountApiKey;
  }

  if (!accountApiKey) {
    throw new Error('Missing BRIA_API_KEY for authenticated API operations');
  }

  let apiMd = metadataWithApiKey(accountApiKey);
  let profiles;
  try {
    profiles = await callUnary(apiClient, 'listProfiles', {}, apiMd);
  } catch (err) {
    if (err?.code !== grpc.status.UNAUTHENTICATED) throw err;

    // Recovery path: existing account key was rotated/lost. Create a fresh account/key.
    const recoveredAccountName = `${accountName}-${Date.now()}`;
    const account = await callUnary(adminClient, 'createAccount', { name: recoveredAccountName }, adminMd);
    accountApiKey = account.key?.key || '';
    if (!accountApiKey) {
      throw new Error('Failed to recover Bria account API key');
    }
    apiMd = metadataWithApiKey(accountApiKey);
    profiles = await callUnary(apiClient, 'listProfiles', {}, apiMd);
  }
  const profileExists = (profiles.profiles || []).some((profile) => profile.name === serviceProfileName);

  if (!profileExists) {
    await callUnary(apiClient, 'createProfile', { name: serviceProfileName }, apiMd);
  }

  const newProfileKey = await callUnary(
    apiClient,
    'createProfileApiKey',
    { profileName: serviceProfileName },
    apiMd,
  );
  generatedProfileApiKey = newProfileKey.key;

  const serviceMd = metadataWithApiKey(generatedProfileApiKey);

  try {
    const keychainConfig = walletXpub
      ? {
          wpkh: {
            xpub: walletXpub,
            derivationPath: walletDerivationPath,
          },
        }
      : {
          descriptors: {
            external: descriptorExternal,
            internal: descriptorInternal,
          },
        };

    await callUnary(
      apiClient,
      'createWallet',
      {
        name: walletName,
        keychainConfig,
      },
      serviceMd,
    );
  } catch (err) {
    if (!isAlreadyExists(err) && !isDuplicateConstraint(err)) throw err;
  }

  try {
    await callUnary(
      apiClient,
      'createPayoutQueue',
      {
        name: payoutQueueName,
        description: 'Koya payout queue',
        config: {
          txPriority: 'NEXT_BLOCK',
          consolidateDeprecatedKeychains: false,
          manual: true,
        },
      },
      serviceMd,
    );
  } catch (err) {
    if (!isAlreadyExists(err) && !isDuplicateConstraint(err)) throw err;
  }

  const verification = await callUnary(
    apiClient,
    'newAddress',
    { walletName },
    serviceMd,
  );

  process.stdout.write(
    JSON.stringify({
      walletName,
      payoutQueueName,
      verificationAddress: verification.address,
      profileApiKey: generatedProfileApiKey,
      generatedAdminApiKey,
    }),
  );
}

main().catch((err) => {
  process.stderr.write(`Provisioning failed: ${err?.message || String(err)}\n`);
  process.exit(1);
});
