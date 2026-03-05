#!/bin/sh
set -eu

cd /workspace
npm run build >/dev/null
node apps/cli/dist/index.js "$@"
