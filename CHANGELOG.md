# Changelog
## [2.1.1] - 2026-03-26
### Changed
- Updated doc organization and content

## [2.1.0] - 2026-03-26
### Added
- Default option in *constructor* method: `exporTime: -1` for automatic configuration of `exportTime` depending on device performance.
- Static method *Rio.model()* to return current RPi model.

## [2.0.11] - 2026-02-13
### Changed
- Minor updates in `README.md`: 
  * Typos in code examples, where imported class is *RIO*, not *Rio*.
  * Details about Node.js pre-requisites.

## [2.0.9] - 2026-02-03
### Changed
- `package.json`: node-gyp version update to fix *tar* vulnerabilities
- `README.md`: Explanations for *tar* warnings.

## [2.0.5] - 2025-12-01
### Changed
- Typos
- Internal refactoring

## [2.0.0] - 2025-11-26
### Added
* Hybrid architecture Javascript + C addon to improve performances
* New API

## [1.2.2] - 2025-11-10
### Changed
* Utility API function name:  `Rio.log` renamed to `Rio.logCfg`.

## [1.2.2] - 2025-11-07
### Added
* Option parameter for method `monitor` to take care of bias and bounces.
### Fixed
* Minor bugs and optimization

## [1.1.0] - 2025-10-31
### Added
* Support libgpiod 2.2.1
* Tested with *Trixie*

## [1.0.0] - 2025-10-23
### Added
Initial release: *Bookworm*, libgpiod 1.63