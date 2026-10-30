# companion-module-vhd-vx61xl

Bitfocus Companion module for the VHD VX61XL / V60 family of PTZ
cameras (VX61XL, V60, VX60ASL, VX61ASL, VX61BASL, VX751BA, VX752A,
V60XL, V61XL, V63XL, V60XS, V61XS, V63XS), controlled over
VISCA-over-IP (TCP, default port 5678).

Built strictly from VHD's official "Command list EN VHD V60" VISCA
table (received 27/08/2026) — 119 actions covering the full standard
PTZ/exposure/color/image command set, using the exact byte encoding
documented for this camera family (which differs in places from the
VX-90's encoding — see below).

This is a sister module to
[companion-module-vhd-vx90](https://github.com/bitfocus/companion-module-vhd-vx90).
The two camera families share most of their VISCA protocol but not
all of it, so each module uses the byte encoding actually documented
for its own camera rather than assuming they're identical.

## What's different from the VX-90 module

- **Not included**: VHD's VX-90-only extensions (ND filter, EIS,
  tally set/brightness, image style, focus lock, audio input, motion
  sync, extended tracking zoom) — not documented for this camera
  family.
- **Included here but not on the VX-90 module**: NR2D, AWB
  Sensitivity, Infrared Remote On/Off, DVI/HDMI output mode, Save
  Current Setting, Pan/Tilt Relative Position, Pan/Tilt Limit Clear,
  Voice Tracking, Sharpness Auto — all documented in the V60 table
  but not in the VX-90 one.
- **Different byte encoding** for the same function: Gain, Bright,
  Brightness, Contrast, Sharpness/Aperture direct values use a finer
  2-byte encoding on this camera family vs. the VX-90's 1-byte
  encoding; Color Temperature direct uses a single raw byte here vs.
  2 bytes on the VX-90; preset numbers go 0-127 here vs. 0-254 on the
  VX-90.

## Compatibility

Uses Companion module API version 1.14.1. Confirmed compatible with
Companion 5.0.4/5.1 (and any Companion version that accepts module API
1.0.0–1.14.x) without requiring the newer v2 API.

## Installation

Once released, add the module from Companion's **Connections** page
(search for "VHD VX61XL"). To test a local build, run `yarn build` and use
**Modules → Import module package** in the Companion admin UI.

## Development

```
corepack enable
yarn install
yarn package   # via @companion-module/tools, produces the .tgz package
```

This repository uses yarn; don't commit a `package-lock.json`.

## Testing status

Built and verified byte-for-byte against VHD's official V60 VISCA
table. Not yet tested against a physical VX61XL/V60 camera — the
reworked 2-byte encodings (Gain/Bright/Brightness/Contrast/Sharpness)
and the raw-byte Color Temperature command are the highest priority
for a first hardware test, since they diverge most from what's
already confirmed working on the VX-90.

## License

MIT
