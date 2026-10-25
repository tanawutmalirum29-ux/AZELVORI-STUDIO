#!/usr/bin/env bash
# Explicit launch of real public lead intake, without payment processing.
# Intentionally requires a verified owner privacy contact and an interactive approval.
set -euo pipefail
export AWS_PAGER='' AWS_REGION=ap-southeast-2 AWS_DEFAULT_REGION=ap-southeast-2

ACCOUNT='301338930958'
APP_ID='d3uhwi8blbgrci'
ORIGIN='https://main.d3uhwi8blbgrci.amplifyapp.com'
API='https://x9r3p2mafl.execute-api.ap-southeast-2.amazonaws.com'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for cmd in aws git node npm npx jq curl; do command -v "$cmd" >/dev/null || {
  echo "Missing tool: $cmd" >&2
  exit 1
}; done
if [[ "$(aws sts get-caller-identity --query Account --output text)" != "$ACCOUNT" ]]; then
  echo "Wrong AWS account; refusing launch" >&2; exit 1
fi
cd "$ROOT"
if [[ "$(git branch --show-current)" != main ]] || ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Use a clean main branch checkout (git switch main && git pull --ff-only)" >&2
  exit 1
fi
if [[ "$(git remote get-url origin)" != "https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO" && "$(git remote get-url origin)" != "https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO.git" ]]; then
  echo "Unexpected GitHub repository; refusing to open intake" >&2; exit 1
fi

CONTACT_EMAIL="${1:-}"
if [[ -z "$CONTACT_EMAIL" ]]; then
  read -r -p "อีเมลจริงสำหรับให้ลูกค้าติดต่อและขอแก้ไข/ลบข้อมูล: " CONTACT_EMAIL
fi
if ! [[ "$CONTACT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Valid privacy-contact email required" >&2; exit 1
fi

echo
echo "Public intake will store real names, email addresses and project briefs on AWS in Sydney."
echo "This contact address will be published publicly on the /privacy page: $CONTACT_EMAIL"
echo "The legal notice needs your review; payments and file uploads remain disabled."
echo "A link being unshared does NOT make the site private."
echo
read -r -p "อ่านและอนุมัติข้อความ /privacy และ /terms และยืนยันว่าอีเมลนี้รับคำขอสิทธิ์ข้อมูลได้จริง? พิมพ์ LEGAL: " LEGAL
if [[ "$LEGAL" != "LEGAL" ]]; then
  echo "Privacy notice not approved. No AWS changes." >&2; exit 1
fi

echo "Checking clean main against remote before public launch…"
git fetch origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "main changed. Run git pull --ff-only origin main and check CI before launch." >&2; exit 1
fi
echo "Building code and calculating AWS diff…"
npm ci --ignore-scripts
npm run build:api
CONTEXT=(
  -c stage=staging
  -c appOrigin="$ORIGIN"
  -c intakeEnabled=true
  -c publicBetaMode=true
  -c pilotEnabled=false
  -c legalReady=true
  -c privacyContactEmail="$CONTACT_EMAIL"
  -c lambdaConcurrency=shared
)
npx cdk diff Azelvori-staging --no-change-set \
  --app 'node --import tsx infrastructure/cdk/app.ts' "${CONTEXT[@]}"
echo
echo "Verify: NO Cognito/DynamoDB replacements or removals; expect Lambda env+code, API throttling and outputs."
read -r -p "After checking the diff type OPEN: " APPROVAL
if [[ "$APPROVAL" != "OPEN" ]]; then echo "Cancelled; no AWS changes"; exit 0; fi

npx cdk deploy Azelvori-staging \
  --app 'node --import tsx infrastructure/cdk/app.ts' "${CONTEXT[@]}"

HEALTH="$(curl --fail --silent --show-error --max-time 20 "$API/health")"
if ! printf '%s' "$HEALTH" | jq -e '.status == "ok" and .intakeEnabled == true and .pilotEnabled == false' >/dev/null; then
  echo "API health did not confirm public intake. Stop; do not publish the frontend yet." >&2
  printf '%s\n' "$HEALTH"
  exit 1
fi
echo "Backend now accepts public briefs; enabling website build settings."

# Preserve every existing branch setting; never overwrite the whole map with only two vars.
OLD="$(aws amplify get-branch --app-id "$APP_ID" --branch-name main --query branch.environmentVariables --output json)"
NEW="$(printf '%s\n' "$OLD" | jq -c --arg contact "$CONTACT_EMAIL" --arg api "$API" --arg origin "$ORIGIN" '
 (. // {}) + {
   VITE_PUBLIC_INTAKE_ENABLED: "true",
   VITE_PRIVACY_CONTACT_EMAIL: $contact,
   VITE_API_BASE_URL: $api,
   VITE_SITE_URL: $origin
 }')"
aws amplify update-branch --app-id "$APP_ID" --branch-name main \
  --environment-variables "$NEW" >/dev/null
echo "Starting Amplify main build…"
JOB="$(aws amplify start-job --app-id "$APP_ID" --branch-name main --job-type RELEASE --query jobSummary.jobId --output text)"
echo
echo "AWS public intake enabled. Amplify build job: $JOB"
echo "Check: https://ap-southeast-2.console.aws.amazon.com/amplify/apps/$APP_ID/branches/main"
echo "After build succeeds test $ORIGIN/start and verify receipt in $ORIGIN/admin"
echo "Existing live payments, public account signup and uploads remain unavailable."
