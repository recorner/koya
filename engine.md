Goal: Add Bria as a first-class service in the Koya repo so it can be started with the existing Docker compose, and prepare a clean, secure, tested integration path for the Koya → Bria adapter and DFNS custody flow. Produce a PR with artifacts, tests, run instructions and a short runbook.

Important: do this incrementally and safely. Make small commits and open a single PR that groups related changes. Every step must include a sanity check and acceptance criteria before continuing.

1) study this project and especially  (first step)



Inspect the repo to find these canonical files/places (already present in Koya):

apps/api/Dockerfile — to mirror container conventions.

docker/run.sh — run helper UX to mirror.

the repo root docker-compose.yml (the compose fragment provided by the user). Use that as the merge target.

Confirm CI credentials and the branch naming convention (use feature branch feature/bria-integration).

Acceptance: Agent lists the above files and returns their paths.

2) Create Bria Dockerfile (multi-stage) — add Dockerfile.bria

Task: Add a Bria multi-stage Dockerfile that:

Builds release Rust binary (cargo build --release --bin bria).

Produces a small runtime image (Debian or slim) with ca-certificates and netcat for health checks.

Runs the binary as a non-root user and sets a safe default CMD that runs bria daemon --config /etc/bria/bria.yml ${BRIA_DATABASE_URL} prod.

Expose port 2742 for development (compose will bind 127.0.0.1:2742:2742).

Checks:

Image must be smaller than 200MB after build (sanity).

Binary present at /usr/local/bin/bria in the runtime image.

USER set to non-root.

Acceptance: Build succeeds locally with docker build -t koyabank/bria -f Dockerfile.bria . and docker run --rm koyabank/bria bria --version prints version.

3) Merge Bria service into the Koya compose file

Task: Update the repo’s docker-compose.yml (the fragment you were given) by adding a bria service that matches Koya conventions:

image: koyabank/bria:latest, container_name: koya-bria.

env_file: docker/bria.env and recommended env names: BRIA_DATABASE_URL, QUICKNODE_RPC_URL, SIGNER_ENCRYPTION_KEY, BRIA_NETWORK, BRIA_API_LISTEN_PORT, RUST_LOG.

volumes: ./config/bria.yml:/etc/bria/bria.yml:ro (config is mounted read-only).

healthcheck uses nc -z localhost ${BRIA_API_LISTEN_PORT}.

restart: unless-stopped.

depends_on uses redis with condition: service_healthy (to reuse existing redis health dependency).

Checks:

Compose parse (docker compose config) succeeds.

docker compose up -d bria successfully creates the container.

Container health becomes healthy within a minute.

Acceptance: docker compose up -d brings up redis, api, and bria (if built), and docker compose ps shows all running.

4) Add run helper & config templates

Task: Add docker/run-bria.sh (Koya run helper style) that:

Accepts --build to rebuild, reads docker/bria.env, mounts config and runs bria daemon ....

Mirrors the behavior/UX of docker/run.sh (same error handling and output pattern).

Add config/bria.yml.example and docker/bria.env.example with placeholder values and comments:

BRIA_DATABASE_URL=postgres://user:pass@host:5432/bria_db

QUICKNODE_RPC_URL=...

SIGNER_ENCRYPTION_KEY=...

BRIA_NETWORK=testnet

BRIA_API_LISTEN_PORT=2742

Checks:

chmod +x docker/run-bria.sh and ./docker/run-bria.sh --build succeed locally (given proper env).

Example files are non-sensitive and include clear instructions to copy to real docker/bria.env.

Acceptance: The run helper builds and starts the container as described and logs show bria daemon started.

5) Add small docs and runbook

Task: Add docs/deployment/bria-runbook.md with:

Which envs are required and descriptions (DB URL, QuickNode key, signer key).

Health checks and how to rotate SIGNER_ENCRYPTION_KEY.

How to run locally (docker/run-bria.sh --build), how to start via docker compose up -d, how to tail logs and check health.

Security notes: TLS, secrets store usage, do not expose gRPC publicly. Mention using Koya conventions for secrets (Secrets Manager / KMS).

Acceptance: Runbook added and referenced by PR description.

6) Safety checks and CI gating

Task: Before merging, ensure:

Compose update does not alter api or redis behavior. Run docker compose config and docker compose -f docker-compose.yml up -d in a clean dev environment.

Lint the Dockerfile with hadolint or similar, and run docker scan for high-severity vulnerabilities.

Add a small GitHub Actions workflow job in PR (or ensure existing CI) that builds the Bria image and runs docker compose config, and runs a lightweight health check nc -z localhost 2742 in a service container job (optional for PR to avoid heavy integration).

Acceptance: CI job passes or the PR is explicitly marked to allow manual check for heavy tasks.

7) Prepare the Koya → Bria adapter task (instructions for later)

(Agent should not implement now, but create an issue or note in PR)

Add a TODO in the PR: extract Bria proto files (from src/api/server/proto or proto/), generate TS gRPC client, implement BriaClientService in NestJS as a module libs/bria-adapter with methods:

createProfileIfNotExists(), createWallet(), submitPayout() / submit_signed_psbt(), journalEventsStream(), and estimateFee().

Document the idempotency strategy: every conversion must have external_id used across DFNS, Bria and Koya DB; store processed external IDs and enforce unique constraint.

Acceptance: PR includes TODO/issue ID for adapter work and mapping notes.

8) Security hardening (must be documented before merge)

Ensure docker/bria.env.example is not committed with real secrets. Add .gitignore or .dockerignore guidance (Koya already uses .dockerignore pattern).

Recommend production deploy flow: secrets in Secrets Manager, TLS termination (ALB) or mTLS for gRPC, private network. Document these in the runbook.

Acceptance: Security checklist included in runbook and PR description.

9) PR description & acceptance criteria (what to include in PR)

Files added: Dockerfile.bria, docker/run-bria.sh, config/bria.yml.example, docker/bria.env.example, updated docker-compose.yml.

Runbook: docs/deployment/bria-runbook.md.

CI check: docker build success and docker compose config success.

Runtime test: logs show bria daemon started; healthcheck becomes healthy.

A created issue for the adapter work and DFNS execution flow with linked acceptance tests.

A short security mitigation note (how to inject secrets and enable TLS).

Merge criteria: PR approved by one backend owner and passes CI build. Optionally, a staging deploy must run smoke tests.

10) Smooth implementation tips for the agent (operational)

Do small commits: Dockerfile + run helper + compose + examples + runbook in separate commits. Reference each commit in PR.

Test locally with a remote Postgres (or add a temporary Postgres dev container in compose) and QuickNode testnet. If remote Postgres unreachable, spin a local Postgres for dev and document it.

Keep Bria read-only config mount and example env files separate from real secrets.

Log & monitor: enable RUST_LOG=info and confirm bria logs contain ledger template initialization messages; record at least one UTXO_DETECTED or PAYOUT_SUBMITTED sample in logs.

Reconciliation: after POC, subscribe to journal_events and push to a Koya test consumer.

Copy-paste agent prompt (single block)

Use this exact block for the agent that will run in Koya (or paste into a ticket):

Agent task: integrate Bria container into Koya and prepare for adapter

Create Dockerfile.bria (multi-stage Rust build → slim runtime), run Bria as non-root, default CMD: bria daemon --config /etc/bria/bria.yml ${BRIA_DATABASE_URL} prod. Validate binary present in runtime image.

Add bria service to docker-compose.yml (use existing file fragment). Service must: use env_file: docker/bria.env, mount config/bria.yml read-only, expose 127.0.0.1:2742:2742, have restart: unless-stopped, and a healthcheck using nc. depends_on must reference redis service with condition: service_healthy.

Add docker/run-bria.sh (Koya-style), config/bria.yml.example, docker/bria.env.example. Ensure run helper supports --build.

Add docs/deployment/bria-runbook.md that lists required envs, run commands, health checks, and security guidance (secrets manager, TLS, do not expose gRPC publicly).

Local checks: docker build -f Dockerfile.bria, docker compose up -d bria, container turns healthy and logs show bria daemon start. Add docker compose config CI step.

Create an issue (or TODO) in the PR for the NestJS BriaClientService adapter: list required gRPC calls and idempotency strategy.

Security: do not commit secrets, use secrets manager in runbook, ensure config/bria.yml is read-only mount.

Make small commits, open feature/bria-integration PR with the files and runbook, request review from backend owner, and include the adapter issue.

Provide acceptance evidence: CI build log, docker compose ps output, docker logs snippet showing daemon started and template init.

here are credentials to use in the env files 
quicknode endpoint https://frosty-little-arrow.btc-testnet4.quiknode.pro/68fad6450fe072a38164588e2eac5340f1d90781

postgress data
DATABASE_URL=postgresql://doadmin:AVNS_al4Rig0Cj2G6VuAz5Lu@167.71.173.146:25060/koya?sslmode=require&sslaccept=accept_invalid_certs&connect_timeout=30
