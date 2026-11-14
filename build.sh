#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
npm --prefix web run build
cargo build --locked --release
if [[ ${1:-} != --binary-only ]]; then
    MAKERS3D_BINARY="${CARGO_TARGET_DIR:-target}/release/makers3d" ./build-appimage.sh
fi
