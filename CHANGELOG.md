# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- English README and English web interface with a RU/EN switch.
- Localized dynamic UI and backend error messages.
- Separate RU and EN standalone HTML build artifacts.
- English routes for the Python and Docker server.
- Community health files, contribution templates, CI, and Dependabot config.

### Changed

- Docker now packages both language versions.
- Development and Docker documentation now describe the English build.

## [1.0.0] - 2026-08-07

### Added

- Local browser-based sing-box 1.12.17 configuration builder.
- Multiple subscription sources with per-node selection.
- VLESS, Trojan, and Hysteria2 conversion for supported transports.
- DIRECT allowlist routing, SELECT/AUTO outbounds, and Yacd settings.
- Safe local Python downloader with SSRF and size-limit protections.
- Docker Compose deployment and non-UI test suite.
