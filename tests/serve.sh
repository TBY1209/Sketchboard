#!/usr/bin/env bash
# Serve the app locally (service worker and some browser APIs need http://, not file://)
cd "$(dirname "$0")/.." && exec python3 -m http.server "${PORT:-8765}" --bind 127.0.0.1
