# @koya/bria-adapter

NestJS library wrapping Bria's gRPC API for Bitcoin custody operations: wallet management, address derivation, payout submission, fee estimation, and real-time event streaming.

## Architecture

```
BriaModule
├── BriaClientService  → Bria API (port 2742) — wallets, addresses, payouts, events
└── BriaAdminService   → Bria Admin (port 2743) — bootstrap, accounts
```

Both services use `@grpc/grpc-js` + `@grpc/proto-loader` for dynamic proto loading at runtime. No code generation step required.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BRIA_API_HOST` | Bria API gRPC host | `localhost` |
| `BRIA_API_PORT` | Bria API gRPC port | `2742` |
| `BRIA_ADMIN_HOST` | Bria Admin gRPC host | `localhost` |
| `BRIA_ADMIN_PORT` | Bria Admin gRPC port | `2743` |
| `BRIA_API_KEY` | Profile API key (from `CreateProfileApiKey`) | — |
| `BRIA_ADMIN_API_KEY` | Admin API key (from `bootstrap`) | — |

## Usage

```typescript
import { BriaModule, BriaClientService } from '@koya/bria-adapter';

@Module({
  imports: [BriaModule],
})
export class AppModule {}

@Injectable()
export class MyService {
  constructor(private readonly bria: BriaClientService) {}

  async sendBtc(address: string, sats: number, sessionId: string) {
    return this.bria.submitPayout({
      walletName: 'koya-hot',
      payoutQueueName: 'default',
      destination: { onchainAddress: address },
      satoshis: sats,
      externalId: sessionId,  // idempotency key
    });
  }
}
```

### Event Streaming

```typescript
const events$ = this.bria.subscribeAll({ afterSequence: lastSequence });
events$.subscribe({
  next: (event) => {
    switch (event.payload.type) {
      case 'payout_settled':
        // Update conversion session status
        break;
      case 'utxo_detected':
        // Incoming payment detected
        break;
    }
  },
});
```

## Proto Files

Proto files are copied from the Bria source (`bria/proto/`). To refresh:

```bash
pnpm -w --filter @koya/bria-adapter run copy-proto
```

## Development

```bash
# Run unit tests (no Bria needed)
pnpm nx test bria-adapter

# Run e2e tests (requires Bria container)
BRIA_API_KEY=<key> BRIA_ADMIN_API_KEY=<key> pnpm nx test bria-adapter --testPathPattern=e2e

# Lint
pnpm nx lint bria-adapter

# Start Bria locally
docker compose up -d bria
```

## Security

- **Never commit API keys** — use `docker/bria.env` (gitignored) or environment variables
- All gRPC calls include `x-bria-api-key` metadata header
- gRPC ports bound to `127.0.0.1` only — not publicly accessible
- See `docs/deployment/bria-runbook.md` for production security guidance

## Idempotency

Every payout uses `external_id` (linked to Koya `conversion_session.id`). Bria enforces uniqueness — retrying with the same `external_id` returns the existing payout. Store `bria_payout_id` in Koya DB after successful submission.
