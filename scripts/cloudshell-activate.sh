#!/usr/bin/env bash
# Run from the owner's AWS CloudShell. AWS credentials stay in that session.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${1:-}" == "--help" ]]; then
  echo "bash scripts/cloudshell-activate.sh [--check] [--region REGION] [--email OWNER_EMAIL]"
  echo "Prepare Node.js/dependencies, then run the interactive activation wizard. See docs/19_CLOUDSHELL_QUICKSTART.md."
  exit 0
fi
command -v aws >/dev/null || { echo "Open AWS CloudShell, or install AWS CLI v2 and sign in first." >&2; exit 1; }
if [[ "$(git branch --show-current)" != "main" ]] || ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Use a clean checkout of main. Save your changes before running this installer." >&2
  exit 1
fi
azelvori_remote="$(git remote get-url origin)"
if [[ "${azelvori_remote%.git}" != "https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO" ]]; then
  echo "This checkout does not match the reviewed AZELVORI repository." >&2
  exit 1
fi
azelvori_work="$(mktemp -d "${TMPDIR:-/tmp}/azelvori-activate.XXXXXXXX")"
trap 'rm -rf -- "$azelvori_work"' EXIT

if ! command -v node >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=14)?0:1)' ; then
  case "$(uname -m)" in
    x86_64) azelvori_arch=x64 ;;
    aarch64) azelvori_arch=arm64 ;;
    *) echo "Unsupported architecture. Use Node.js >=22.14 and npm run activate." >&2; exit 1 ;;
  esac
  echo "Preparing Node.js 22 from nodejs.org for this command only…"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o "$azelvori_work/SHASUMS256.txt"
  azelvori_archive="$(awk -v arch="$azelvori_arch" '$2 ~ ("^node-v22\\.[0-9]+\\.[0-9]+-linux-" arch "\\.tar\\.xz$") {print $2}' "$azelvori_work/SHASUMS256.txt")"
  [[ "$azelvori_archive" =~ ^node-v22\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || { echo "Cannot verify the official Node.js archive name." >&2; exit 1; }
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    "https://nodejs.org/dist/latest-v22.x/$azelvori_archive" -o "$azelvori_work/$azelvori_archive"
  awk -v archive="$azelvori_archive" '$2 == archive {print}' "$azelvori_work/SHASUMS256.txt" > "$azelvori_work/checksum.txt"
  (cd "$azelvori_work" && sha256sum --check checksum.txt)
  mkdir "$azelvori_work/node"
  tar -xJf "$azelvori_work/$azelvori_archive" -C "$azelvori_work/node" --strip-components=1 --no-same-owner
  export PATH="$azelvori_work/node/bin:$PATH"
fi
node --version
npm ci --ignore-scripts --cache "$azelvori_work/npm-cache"
npm run activate -- "$@"
