# Nightly Runner Setup

Owner: @recorner

## Overview

The nightly DFNS integration test runs on a self-hosted GitHub Actions runner with Docker. The runner is provisioned on an EC2 instance with IAM access to AWS Secrets Manager for DFNS credentials.

## Provisioning

### Option A: CloudFormation

```bash
aws cloudformation create-stack \
  --stack-name koya-runner \
  --template-body file://terraform/aws/runner_cf.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=KeyName,ParameterValue=your-key \
    ParameterKey=VpcId,ParameterValue=vpc-xxx \
    ParameterKey=SubnetId,ParameterValue=subnet-xxx \
    ParameterKey=GitHubTokenSecretArn,ParameterValue=arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:koya-gh-runner-token
```

### Option B: Manual Setup

1. Launch an Ubuntu 22.04 EC2 instance (t3.medium, 50GB gp3)
2. Attach an IAM role with Secrets Manager access
3. Generate a GitHub runner registration token:
   ```bash
   curl -L -X POST \
     -H "Authorization: Bearer $GITHUB_PAT" \
     https://api.github.com/repos/westronet/koya/actions/runners/registration-token \
     | jq -r .token
   ```
4. SSH in and run:
   ```bash
   bash scripts/setup-self-hosted-runner.sh <RUNNER_TOKEN>
   ```

## Architecture

```
┌─────────────────────────────────────────────┐
│            EC2 (t3.medium)                  │
│                                             │
│  ┌──────────────────┐ ┌──────────────────┐  │
│  │  GitHub Runner   │ │     Docker       │  │
│  │  Agent (svc)     │ │                  │  │
│  │                  │ │  ┌────────────┐  │  │
│  │  Picks up:       │ │  │ bria-pg    │  │  │
│  │  - nightly cron  │ │  │ bria       │  │  │
│  │  - manual trigger│ │  │ redis      │  │  │
│  │                  │ │  │ koya api   │  │  │
│  └──────────────────┘ │  └────────────┘  │  │
│                       └──────────────────┘  │
│                                             │
│  IAM Role: koya-runner-role-{env}           │
│  - secretsmanager:GetSecretValue /koya/dfns │
│  - s3:PutObject koya-archives-*             │
│  - cloudwatch:PutMetricData                 │
└─────────────────────────────────────────────┘
```

## Runner Labels

The runner registers with labels: `self-hosted`, `linux`, `docker`

The nightly workflow targets: `runs-on: [self-hosted, linux, docker]`

## Workflow: nightly-dfns-integration.yml

| Step | Action |
|------|--------|
| 1 | Checkout code |
| 2 | Configure AWS credentials (OIDC role assumption) |
| 3 | Fetch DFNS secrets from Secrets Manager → `docker/secrets/` |
| 4 | Check certificate expiry (warn if <14 days) |
| 5 | Install pnpm + Node.js 22 |
| 6 | `pnpm install --frozen-lockfile` |
| 7 | `docker compose up -d --build --wait` |
| 8 | Wait for API health |
| 9 | Run DFNS integration tests |
| 10 | Probe DFNS health endpoint |
| 11 | Collect and upload Docker logs |
| 12 | Tear down stack |

## Troubleshooting

### Runner not appearing in GitHub

1. Check `/opt/actions-runner/svc.sh status`
2. Check `/opt/actions-runner/_diag/Runner_*.log`
3. Registration token may have expired (tokens are valid for 1 hour). Generate a new one.

### Integration tests timing out

1. Check Docker is running: `docker info`
2. Check disk space: `df -h` (need >10GB free)
3. Check `docker compose logs` for startup failures
4. Verify Secrets Manager access: `aws secretsmanager get-secret-value --secret-id /koya/dfns/apiKey`

### Runner disk full

The runner accumulates Docker images over time.

```bash
docker system prune -af --volumes
```

Consider adding a weekly cron: `0 0 * * 0 docker system prune -af --volumes`
