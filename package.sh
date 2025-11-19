#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${REPO_ROOT}/dist"
ARTIFACT="${DIST_DIR}/nn-portfoliorefresher.zip"

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

pushd "${REPO_ROOT}" >/dev/null
zip -r "${ARTIFACT}" \
  manifest.json \
  content.js \
  popup.html \
  popup.js
popd >/dev/null

echo "Packaged extension at ${ARTIFACT}"
