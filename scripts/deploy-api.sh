#!/bin/bash
set -euo pipefail

# Deploy script: Run migrations as a one-off ECS task, then update the API service.
#
# Usage:
#   ./scripts/deploy-api.sh [image-tag]
#
# Prerequisites:
#   - AWS CLI configured
#   - ECR image already pushed
#   - ECS cluster and service exist

CLUSTER="koya-api"
SERVICE="koya-api-service"
MIGRATE_TASK_FAMILY="koya-api-migrate"
API_TASK_FAMILY="koya-api"
IMAGE_TAG="${1:-latest}"
REGION="us-east-1"
ACCOUNT_ID="286119371044"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/koya/api:${IMAGE_TAG}"

# Subnets and security group (same as the ECS service)
SUBNETS="subnet-0a1b2c3d4e5f67890"  # Replace with actual subnet IDs
SECURITY_GROUP="sg-0a1b2c3d4e5f67890"  # Replace with actual SG ID

echo "=== Step 1: Run database migrations ==="
TASK_ARN=$(aws ecs run-task \
  --cluster "${CLUSTER}" \
  --task-definition "${MIGRATE_TASK_FAMILY}" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=ENABLED}" \
  --region "${REGION}" \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Migration task started: ${TASK_ARN}"
echo "Waiting for migration task to complete..."

aws ecs wait tasks-stopped \
  --cluster "${CLUSTER}" \
  --tasks "${TASK_ARN}" \
  --region "${REGION}"

# Check exit code
EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "${CLUSTER}" \
  --tasks "${TASK_ARN}" \
  --region "${REGION}" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

if [ "${EXIT_CODE}" != "0" ]; then
  echo "ERROR: Migration task failed with exit code ${EXIT_CODE}"
  echo "Check CloudWatch logs: /ecs/koya-api (stream prefix: migrate)"
  exit 1
fi

echo "Migrations completed successfully."

echo ""
echo "=== Step 2: Update API service ==="
aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE}" \
  --force-new-deployment \
  --region "${REGION}" \
  --query 'service.deployments[0].status' \
  --output text

echo "API service update triggered. Monitor with:"
echo "  aws ecs describe-services --cluster ${CLUSTER} --services ${SERVICE} --region ${REGION}"
echo ""
echo "=== Deploy complete ==="
