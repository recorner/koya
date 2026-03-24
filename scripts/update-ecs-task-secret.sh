#!/usr/bin/env bash
# scripts/update-ecs-task-secret.sh
# Update an ECS task definition to reference new Secrets Manager ARN versions,
# then force a new deployment.
#
# Usage:
#   ./scripts/update-ecs-task-secret.sh \
#     --cluster koya-production \
#     --service koya-api \
#     --task-family koya-api \
#     [--region us-east-1]

set -euo pipefail

CLUSTER=""
SERVICE=""
TASK_FAMILY=""
REGION="us-east-1"

while [[ $# -gt 0 ]]; do
  case $1 in
    --cluster) CLUSTER="$2"; shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --task-family) TASK_FAMILY="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$CLUSTER" || -z "$SERVICE" || -z "$TASK_FAMILY" ]]; then
  echo "Usage: $0 --cluster <cluster> --service <service> --task-family <family> [--region <region>]"
  exit 1
fi

echo "=== Updating ECS Task Definition ==="

# Get current task definition
CURRENT_TD=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION" \
  --query 'services[0].taskDefinition' \
  --output text)

echo "Current task definition: $CURRENT_TD"

# Get the task definition JSON (strip AWS-managed fields)
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "$CURRENT_TD" \
  --region "$REGION" \
  --query 'taskDefinition' \
  --output json)

# Register a new revision (same content — this picks up latest secret versions)
NEW_TD=$(echo "$TASK_DEF" | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' | \
  aws ecs register-task-definition \
    --cli-input-json file:///dev/stdin \
    --region "$REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "New task definition: $NEW_TD"

# Force new deployment
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$NEW_TD" \
  --force-new-deployment \
  --region "$REGION" \
  --query 'service.deployments[0].{status:status,desired:desiredCount,running:runningCount}' \
  --output table

echo ""
echo "=== Deployment triggered ==="
echo "Monitor: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query 'services[0].deployments'"
