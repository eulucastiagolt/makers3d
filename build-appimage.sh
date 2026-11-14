#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"

arch=$(uname -m)
name="Makers3D-${arch}.AppImage"
app_id=io.github.eulucastiagolt.Makers3D
app_dir=$(mktemp -d)
chmod 755 "$app_dir"
output_dir=
trap 'rm -rf -- "$app_dir"; if [[ -n $output_dir ]]; then rm -rf -- "$output_dir"; fi' EXIT

install -Dm755 data/AppRun "$app_dir/AppRun"
if [[ -z ${MAKERS3D_BINARY:-} ]]; then
    ./build.sh --binary-only
fi
install -Dm755 "${MAKERS3D_BINARY:-${CARGO_TARGET_DIR:-target}/release/makers3d}" "$app_dir/usr/bin/makers3d"
install -Dm644 "data/$app_id.desktop" "$app_dir/$app_id.desktop"
install -Dm644 "data/$app_id.desktop" "$app_dir/usr/share/applications/$app_id.desktop"
install -Dm644 "data/$app_id.svg" "$app_dir/$app_id.svg"
install -Dm644 "data/$app_id.metainfo.xml" "$app_dir/usr/share/metainfo/$app_id.appdata.xml"
rsvg-convert -w 256 -h 256 "data/$app_id.svg" -o "$app_dir/$app_id.png"

args=(--no-appstream)
if [[ -n ${UPDATE_INFORMATION:-} ]]; then
    command -v zsyncmake >/dev/null
    args+=(-u "$UPDATE_INFORMATION")
fi
if [[ -n ${APPIMAGE_RUNTIME:-} ]]; then
    args+=(--runtime-file "$(realpath -- "$APPIMAGE_RUNTIME")")
fi

mkdir -p dist
output_dir=$(mktemp -d "$PWD/dist/.appimage.XXXXXX")
(
    cd "$output_dir"
    ARCH="$arch" appimagetool "${args[@]}" "$app_dir" "$name"
    if [[ -n ${UPDATE_INFORMATION:-} && ! -s $name.zsync ]]; then
        zsyncmake -u "$name" -o "$name.zsync" "$name"
    fi
)
mv -fT -- "$output_dir/$name" "dist/$name"
if [[ -n ${UPDATE_INFORMATION:-} ]]; then
    mv -fT -- "$output_dir/$name.zsync" "dist/$name.zsync"
else
    rm -f -- "dist/$name.zsync"
fi
