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

const walletName = process.env.BRIA_WALLET_NAME || 'koya-wallet';
const payoutQueueName = process.env.BRIA_PAYOUT_QUEUE_NAME || process.env.BRIA_PAYOUT_QUEUE || 'default';
const serviceProfileName = process.env.BRIA_SERVICE_PROFILE || `${walletName}-service`;
const accountName = process.env.BRIA_ACCOUNT_NAME || `${walletName}-account`;
const btcPolicyNetwork = (process.env.BTC_NETWORK || 'testnet4').toLowerCase();

const briaApiKey = process.env.BRIA_API_KEY || '';
const briaAdminApiKey = process.env.BRIA_ADMIN_API_KEY || '';

if (!briaApiKey) {
  throw new Error('Missing BRIA_API_KEY');
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
  const apiMd = metadataWithApiKey(briaApiKey);

  const result = {
    accountName,
    serviceProfileName,
    walletName,
    payoutQueueName,
    policyFamily: expectedAddressFamily(btcPolicyNetwork),
    probeAddress: null,
    detectedFamily: 'unknown',
    walletFound: false,
    payoutQueueFound: false,
    profileFound: false,
    accountFound: false,
    errors: {},
  };

  try {
    const profiles = await callUnary(apiClient, 'listProfiles', {}, apiMd);
    result.profileFound = Boolean((profiles.profiles || []).some((p) => p.name === serviceProfileName));
  } catch (err) {
    result.errors.profileLookup = err?.details || err?.message || String(err);
  }

  try {
    const wallets = await callUnary(apiClient, 'listWallets', {}, apiMd);
    result.walletFound = Boolean((wallets.wallets || []).some((w) => w.name === walletName));
  } catch (err) {
    result.errors.walletLookup = err?.details || err?.message || String(err);
  }

  try {
    const queues = await callUnary(apiClient, 'listPayoutQueues', {}, apiMd);
    result.payoutQueueFound = Boolean((queues.payoutQueues || []).some((q) => q.name === payoutQueueName));
  } catch (err) {
    result.errors.payoutQueueLookup = err?.details || err?.message || String(err);
  }

  try {
    const probe = await callUnary(
      apiClient,
      'newAddress',
      {
        walletName,
        externalId: `koya:lineage:probe:${Date.now()}`,
      },
      apiMd,
    );
    result.probeAddress = probe.address;
    result.detectedFamily = detectAddressFamily(probe.address);
  } catch (err) {
    result.errors.addressProbe = err?.details || err?.message || String(err);
  }

  if (briaAdminApiKey) {
    try {
      const adminClient = await createAdminClient();
      const adminMd = metadataWithApiKey(briaAdminApiKey, 'x-bria-admin-api-key');
      const accounts = await callUnary(adminClient, 'listAccounts', {}, adminMd);
      result.accountFound = Boolean((accounts.accounts || []).some((a) => a.name === accountName));
    } catch (err) {
      result.errors.accountLookup = err?.details || err?.message || String(err);
    }
  } else {
    result.errors.accountLookup = 'BRIA_ADMIN_API_KEY unavailable; account lookup skipped';
  }

  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  process.stderr.write(`Lineage inspection failed: ${err?.message || String(err)}\n`);
  process.exit(1);
});
