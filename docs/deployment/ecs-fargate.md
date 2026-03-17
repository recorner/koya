# AWS ECS Fargate — Koya API Deployment

## Architecture

```
Internet → ALB (443/HTTPS) → ECS Fargate Service → Container (3333)
                                                  ↓
                                    DigitalOcean Managed PostgreSQL
```

## Prerequisites

1. AWS CLI configured with appropriate IAM permissions
2. ECR repository created
3. VPC with public/private subnets
4. ACM certificate for API domain (`api.koyabank.com`)
5. `DATABASE_URL` stored in AWS Secrets Manager

---

## ECR Setup

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name koya/api \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
```

## Build & Push

```bash
# Build from workspace root (context needs full monorepo)
docker build -f apps/api/Dockerfile -t koya-api .

# Tag & push
docker tag koya-api:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/koya/api:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/koya/api:latest
```

---

## ECS Task Definition

```json
{
  "family": "koya-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/koyaApiTaskRole",
  "containerDefinitions": [
    {
      "name": "koya-api",
      "image": "<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/koya/api:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3333,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3333" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:koya/api/DATABASE_URL"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/koya-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -qO- http://localhost:3333/api/v1/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

---

## ECS Service

```bash
# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/koya-api

# Register task definition
aws ecs register-task-definition --cli-input-json file://infra/ecs-task-definition.json

# Create ECS cluster
aws ecs create-cluster --cluster-name koya

# Create service (adjust subnet/sg IDs)
aws ecs create-service \
  --cluster koya \
  --service-name koya-api \
  --task-definition koya-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=koya-api,containerPort=3333"
```

---

## ALB Configuration

1. Create Application Load Balancer in public subnets
2. HTTPS listener (443) with ACM certificate
3. Target group → port 3333, health check: `GET /api/v1/health`
4. Security group: allow 443 inbound, 3333 to ECS tasks

---

## Security Group Rules

**ALB Security Group:**
- Inbound: 443/TCP from 0.0.0.0/0
- Outbound: 3333/TCP to ECS security group

**ECS Security Group:**
- Inbound: 3333/TCP from ALB security group
- Outbound: 25060/TCP to DigitalOcean PostgreSQL (167.71.173.146)
- Outbound: 443/TCP to 0.0.0.0/0 (ECR pulls, external APIs)

---

## Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Secrets Manager | PostgreSQL connection string |
| `NODE_ENV` | Task definition | `production` |
| `PORT` | Task definition | `3333` |
| `MPESA_CONSUMER_KEY` | Secrets Manager | Safaricom API key |
| `MPESA_CONSUMER_SECRET` | Secrets Manager | Safaricom API secret |
| `MPESA_PASSKEY` | Secrets Manager | Safaricom passkey |
| `MPESA_SHORTCODE` | Secrets Manager | M-Pesa shortcode |
| `RATE_PROVIDER_API_KEY` | Secrets Manager | Rate API key |
| `BTC_DELIVERY_API_KEY` | Secrets Manager | BTC delivery key |

---

## CI/CD (GitHub Actions)

Add to `.github/workflows/deploy-api.yml`:

```yaml
name: Deploy API
on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'libs/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/github-actions-deploy
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & push image
        run: |
          docker build -f apps/api/Dockerfile -t ${{ env.ECR_REGISTRY }}/koya/api:${{ github.sha }} .
          docker push ${{ env.ECR_REGISTRY }}/koya/api:${{ github.sha }}

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster koya \
            --service koya-api \
            --force-new-deployment
```

---

## Estimated Costs (us-east-1)

| Resource | Spec | ~Monthly |
|----------|------|----------|
| ECS Fargate (2 tasks) | 0.5 vCPU, 1 GB | ~$30 |
| ALB | Standard | ~$20 |
| CloudWatch Logs | 5 GB | ~$3 |
| ECR | 2 GB images | ~$0.20 |
| **Total** | | **~$53/mo** |
