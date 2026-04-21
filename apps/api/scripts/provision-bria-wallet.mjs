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

const freshLineage = (process.env.BRIA_PROVISION_FRESH_LINEAGE || '').toLowerCase() === 'true';
const defaultLineageTag = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
const configuredLineageTag = process.env.BRIA_PROVISION_LINEAGE_TAG || defaultLineageTag;
const lineageTag = configuredLineageTag.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
const lineageSuffix = freshLineage ? `-${lineageTag}` : '';

const walletNameBase = process.env.BRIA_WALLET_NAME || 'koya-testnet4';
const payoutQueueNameBase =
  process.env.BRIA_PAYOUT_QUEUE_NAME || process.env.BRIA_PAYOUT_QUEUE || 'koya-payouts';
const serviceProfileNameBase = process.env.BRIA_SERVICE_PROFILE || 'koya-service';
const accountNameBase = process.env.BRIA_ACCOUNT_NAME || 'koya';
const walletName = `${walletNameBase}${lineageSuffix}`;
const payoutQueueName = `${payoutQueueNameBase}${lineageSuffix}`;
const serviceProfileName = `${serviceProfileNameBase}${lineageSuffix}`;
const accountName = `${accountNameBase}${lineageSuffix}`;
const outputSecretsFile = process.env.BRIA_PROVISION_SECRETS_FILE || '';

const descriptorExternal = process.env.BRIA_WALLET_DESCRIPTOR_EXTERNAL || '';
const descriptorInternal = process.env.BRIA_WALLET_DESCRIPTOR_INTERNAL || '';
const walletXpub = process.env.BRIA_WALLET_XPUB || '';
const walletDerivationPath = process.env.BRIA_WALLET_DERIVATION_PATH || 'm/84h/1h/0h';
const btcPolicyNetwork = (process.env.BTC_NETWORK || 'testnet4').toLowerCase();

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

function expectedAddressFamily(policyNetwork) {
  if (policyNetwork === 'mainnet' || policyNetwork === 'bitcoin') return 'mainnet';
  if (policyNetwork === 'testnet' || policyNetwork === 'testnet4' || policyNetwork === 'signet') return 'testnet';
  return 'regtest';
}

function detectAddressFamily(address) {
  const value = String(address || '').trim().toLowerCase();
  if (value.startsWith('bc1') || value.startsWith('1') || value.startsWith('3')) return 'mainnet';
  if (value.startsWith('tb1') || value.startsWith('m') || value.startsWith('n') || value.startsWith('2')) return 'testnet';
  if (value.startsWith('bcrt1')) return 'regtest';
  return 'unknown';
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
  } else if (freshLineage) {
    throw new Error(
      `Fresh-lineage provisioning requires a unique BRIA_PROVISION_LINEAGE_TAG. Account already exists: ${accountName}`,
    );
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
  } else if (freshLineage) {
    throw new Error(
      `Fresh-lineage provisioning requires a unique BRIA_PROVISION_LINEAGE_TAG. Profile already exists: ${serviceProfileName}`,
    );
  }

  const newProfileKey = await callUnary(
    apiClient,
    'createProfileApiKey',
    { profileName: serviceProfileName },
    apiMd,
  );
  generatedProfileApiKey = newProfileKey.key;

  const serviceMd = metadataWithApiKey(generatedProfileApiKey);

  let walletAlreadyExists = false;
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
    if (isDuplicateConstraint(err)) {
      throw new Error(
        'Lineage guard blocked descriptor reuse. Provide fresh descriptor/xpub material or reprovision Bria on a fresh tenant/database.',
      );
    }
    if (isAlreadyExists(err)) {
      walletAlreadyExists = true;
      if (freshLineage) {
        throw new Error(
          `Fresh-lineage provisioning requires a unique BRIA_PROVISION_LINEAGE_TAG. Wallet already exists: ${walletName}`,
        );
      }
    } else {
      throw err;
    }
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
    if (isDuplicateConstraint(err)) {
      throw new Error(
        'Lineage guard blocked payout queue reuse under incompatible lineage. Use fresh lineage names or clean tenant state.',
      );
    }
    if (!isAlreadyExists(err)) throw err;
  }

  const verification = await callUnary(
    apiClient,
    'newAddress',
    { walletName },
    serviceMd,
  );

  const expectedFamily = expectedAddressFamily(btcPolicyNetwork);
  const detectedFamily = detectAddressFamily(verification.address);
  if (expectedFamily !== detectedFamily) {
    const guardContext = walletAlreadyExists
      ? 'Lineage guard blocked reuse of existing wallet because emitted family does not match policy.'
      : 'Provisioned wallet emitted incompatible family.';
    throw new Error(
      `${guardContext} address=${verification.address} expected=${expectedFamily} detected=${detectedFamily} (BTC_NETWORK=${btcPolicyNetwork})`,
    );
  }

  if (!outputSecretsFile) {
    throw new Error('BRIA_PROVISION_SECRETS_FILE is required to safely capture generated API keys');
  }

  fs.writeFileSync(
    outputSecretsFile,
    JSON.stringify({
      profileApiKey: generatedProfileApiKey,
      generatedAdminApiKey,
    }),
    { encoding: 'utf8', mode: 0o600 },
  );

  process.stdout.write(
    JSON.stringify({
      accountName,
      serviceProfileName,
      walletName,
      payoutQueueName,
      verificationAddress: verification.address,
      freshLineage,
      lineageTag: freshLineage ? lineageTag : null,
    }),
  );
}

main().catch((err) => {
  process.stderr.write(`Provisioning failed: ${err?.message || String(err)}\n`);
  process.exit(1);
});
