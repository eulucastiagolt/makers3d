.PHONY: build dev check test dist release

build:
	./build.sh --binary-only

dev:
	npm --prefix web run build
	cargo run --locked

check:
	npm --prefix web run check
	npm --prefix web run build
	cargo fmt --check
	cargo clippy --locked --all-targets -- -D warnings

test:
	npm --prefix web run build
	cargo test --locked

dist:
	./build.sh
	cd dist && sha256sum *.AppImage > SHA256SUMS

release:
	git push origin main --follow-tags
