# VHD VX61XL / V60 PTZ Camera

Controls the VHD V60 family of PTZ cameras over **VISCA-over-IP (TCP)**:
VX61XL, V60, VX60ASL, VX61ASL, VX61BASL, VX751BA, VX752A, V60XL, V61XL,
V63XL, V60XS, V61XS and V63XS.

## Connection

- **IP address**: the camera's LAN IP.
- **Port**: 5678 by default (the camera's "PTZ port" setting in its
  network configuration).
- **VISCA address**: 1 by default (matches the camera's factory default).

The connection status is also available as the variable
`$(<connection label>:connection_status)`, where the label is the name shown
in the Connections list (`vx61xl` by default).

## Where these commands come from

This module is built from VHD's official "Command list EN VHD V60"
VISCA table. Most commands match Sony's public VISCA specification, but
this camera family uses its own encoding for some values:

- **Gain, Bright, Brightness, Contrast and Sharpness/Aperture** (direct
  values) use a 2-byte encoding.
- **Color Temperature** (direct) uses a single raw byte.
- **Presets** range from 0 to 127.

It also includes commands documented for this family only, such as
NR2D, AWB Sensitivity, Infrared Remote On/Off, DVI/HDMI output mode,
Save Current Setting, Pan/Tilt Relative Position, Pan/Tilt Limit Clear,
Voice Tracking and Sharpness Auto.

For the VHD VX-90, use the separate **VHD VX-90 PTZ Camera** module.

## Known limitations

- Inquiry commands (reading back the camera's current state) are not
  implemented yet. A `connected` feedback is included, but there is no
  per-parameter feedback.
- The direct-value commands with the family-specific encoding listed
  above should be spot-checked the first time you use them.

## Troubleshooting

Check the connection's log in Companion: every command sent and every
reply received is logged as `TX:` / `RX:` hex at debug level.

## Support

Module built for AP Audiovisuele Producties. Report problems on the
[issue tracker](https://github.com/bitfocus/companion-module-vhd-vx61xl/issues).
