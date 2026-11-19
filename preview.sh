#!/bin/sh
set -eu

cd "$(dirname "$0")"
root=$(pwd -P)
[ -f "$root/_site/index.html" ] || {
    printf '%s\n' 'Missing _site/index.html. Run ./build.sh first.' >&2
    exit 1
}

preview=$(mktemp -d "${TMPDIR:-/tmp}/puzzleweb-preview.XXXXXX")
trap 'rm -rf "$preview"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
ln -s "$root/_site" "$preview/puzzleweb"
printf '%s\n' 'Preview at http://127.0.0.1:8090/puzzleweb/'
python3 -m http.server 8090 --bind 127.0.0.1 --directory "$preview"
