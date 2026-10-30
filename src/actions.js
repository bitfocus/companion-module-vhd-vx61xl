const { nibbleBytes, signedNibbleBytes16, buildCommand } = require('./visca')

/**
 * Action set for the VHD VX61XL / V60 family (VX60ASL, VX61ASL, VX61BASL,
 * VX751BA, VX752A, V60XL, V61XL, V63XL, V60XS, V61XS, V63XS), built strictly
 * from VHD's official "Command list EN VHD V60" VISCA table (as received
 * from VHD contact Li, 27/08/2026).
 *
 * Every action below is either byte-identical to the VX-90 module's version
 * (confirmed via a full byte-level comparison against VHD's VX-90 table) or
 * uses the encoding actually documented in the V60 table where it differs
 * (Gain, Bright/Brightness, Contrast, Aperture/Sharpness, Color Temperature,
 * preset number range). VX-90-only extensions ([VHD-ext] commands: ND
 * filter, tally set/brightness, EIS, image style, focus lock, audio input,
 * motion sync, extended tracking) are intentionally NOT included here since
 * they are not documented for this camera family.
 */
function getActionDefinitions(instance) {
	const send = (bytes) => instance.sendBuffer(buildCommand(instance.viscaAddress, bytes))
	/** Raw broadcast frame (no per-camera address byte, e.g. AddressSet). */
	const sendRaw = (bytes) => instance.sendBuffer(Buffer.from([...bytes, 0xff]))

	const simple = (name, bytes) => ({
		name,
		options: [],
		callback: () => send(bytes),
	})

	const choiceAction = (name, prefixBytes, choices, defaultId, suffixBytes = []) => ({
		name,
		options: [{ id: 'value', type: 'dropdown', label: name, default: defaultId, choices }],
		callback: (event) => {
			send([...prefixBytes, parseInt(event.options.value, 16), ...suffixBytes])
		},
	})

	const numberAction = (name, prefixBytes, min, max, def, nibbleCount, note) => ({
		name,
		options: [{ id: 'value', type: 'number', label: 'Value', description: note, min, max, default: def, range: false }],
		callback: (event) => {
			send([...prefixBytes, ...nibbleBytes(Number(event.options.value), nibbleCount)])
		},
	})

	const byteAction = (name, prefixBytes, min, max, def, note) => ({
		name,
		options: [{ id: 'value', type: 'number', label: 'Value', description: note, min, max, default: def, range: false }],
		callback: (event) => {
			send([...prefixBytes, Number(event.options.value) & 0xff])
		},
	})

	const onOff = (name, prefixBytes, onByte = 0x02, offByte = 0x03) => ({
		name,
		options: [
			{
				id: 'value',
				type: 'dropdown',
				label: name,
				default: 'on',
				choices: [
					{ id: 'on', label: 'On' },
					{ id: 'off', label: 'Off' },
				],
			},
		],
		callback: (event) => send([...prefixBytes, event.options.value === 'on' ? onByte : offByte]),
	})

	const actions = {}

	// ---------- SYSTEM ----------
	actions.address_set_broadcast = {
		name: 'Address Set (broadcast)',
		options: [],
		callback: () => sendRaw([0x88, 0x30, 0x01]),
	}
	actions.power = onOff('Power', [0x01, 0x04, 0x00])
	actions.setting_save = simple('Save Current Setting', [0x01, 0x04, 0xa5, 0x10])
	actions.setting_reset = simple('Restore Menu Defaults', [0x01, 0x04, 0xa0, 0x10])
	actions.dvi_mode = onOff('DVI Output Mode (On=DVI, Off=HDMI default)', [0x01, 0x04, 0xab], 0x03, 0x02)
	actions.ir_remote = onOff('Infrared Remote Control', [0x01, 0x06, 0x08])

	// ---------- ZOOM ----------
	actions.zoom_stop = simple('Zoom: Stop', [0x01, 0x04, 0x07, 0x00])
	actions.zoom_tele_std = simple('Zoom: Tele (standard speed)', [0x01, 0x04, 0x07, 0x02])
	actions.zoom_wide_std = simple('Zoom: Wide (standard speed)', [0x01, 0x04, 0x07, 0x03])
	actions.zoom_tele_var = {
		name: 'Zoom: Tele (variable speed 0-7)',
		options: [{ id: 'value', type: 'number', label: 'Speed', min: 0, max: 7, default: 4 }],
		callback: (event) => send([0x01, 0x04, 0x07, 0x20 | (Number(event.options.value) & 0x0f)]),
	}
	actions.zoom_wide_var = {
		name: 'Zoom: Wide (variable speed 0-7)',
		options: [{ id: 'value', type: 'number', label: 'Speed', min: 0, max: 7, default: 4 }],
		callback: (event) => send([0x01, 0x04, 0x07, 0x30 | (Number(event.options.value) & 0x0f)]),
	}
	actions.zoom_to = {
		name: 'Zoom: Direct Position (0-16384)',
		options: [{ id: 'value', type: 'number', label: 'Zoom position', min: 0, max: 0x4000, default: 0 }],
		callback: (event) => send([0x01, 0x04, 0x47, ...nibbleBytes(Number(event.options.value), 4)]),
	}

	// ---------- FOCUS ----------
	actions.focus_stop = simple('Focus: Stop', [0x01, 0x04, 0x08, 0x00])
	actions.focus_far_std = simple('Focus: Far (standard speed)', [0x01, 0x04, 0x08, 0x02])
	actions.focus_near_std = simple('Focus: Near (standard speed)', [0x01, 0x04, 0x08, 0x03])
	actions.focus_far_var = {
		name: 'Focus: Far (variable speed 0-7)',
		options: [{ id: 'value', type: 'number', label: 'Speed', min: 0, max: 7, default: 4 }],
		callback: (event) => send([0x01, 0x04, 0x08, 0x20 | (Number(event.options.value) & 0x0f)]),
	}
	actions.focus_near_var = {
		name: 'Focus: Near (variable speed 0-7)',
		options: [{ id: 'value', type: 'number', label: 'Speed', min: 0, max: 7, default: 4 }],
		callback: (event) => send([0x01, 0x04, 0x08, 0x30 | (Number(event.options.value) & 0x0f)]),
	}
	actions.focus_to = {
		name: 'Focus: Direct Position',
		options: [{ id: 'value', type: 'number', label: 'Focus position', min: 0, max: 0xffff, default: 0 }],
		callback: (event) => send([0x01, 0x04, 0x48, ...nibbleBytes(Number(event.options.value), 4)]),
	}
	actions.focus_mode_auto = simple('Focus: Auto', [0x01, 0x04, 0x38, 0x02])
	actions.focus_mode_manual = simple('Focus: Manual', [0x01, 0x04, 0x38, 0x03])
	actions.focus_mode_toggle = simple('Focus: Auto/Manual Toggle', [0x01, 0x04, 0x38, 0x10])
	actions.af_sense = choiceAction(
		'Focus: AF Sensitivity',
		[0x01, 0x04, 0x58],
		[
			{ id: '1', label: 'High' },
			{ id: '2', label: 'Normal' },
			{ id: '3', label: 'Low' },
		],
		'2',
	)
	actions.af_zone = choiceAction(
		'Focus: AF Zone',
		[0x01, 0x04, 0xaa],
		[
			{ id: '0', label: 'Top' },
			{ id: '1', label: 'Center' },
			{ id: '2', label: 'Bottom' },
		],
		'1',
	)
	actions.awb_sensitivity = choiceAction(
		'AWB Sensitivity',
		[0x01, 0x04, 0xa9],
		[
			{ id: '0', label: 'High' },
			{ id: '1', label: 'Normal' },
			{ id: '2', label: 'Low' },
		],
		'1',
	)

	// ---------- WHITE BALANCE / COLOR TEMPERATURE ----------
	actions.wb_mode = choiceAction(
		'White Balance Mode',
		[0x01, 0x04, 0x35],
		[
			{ id: '00', label: 'Auto' },
			{ id: '01', label: 'Indoor' },
			{ id: '02', label: 'Outdoor' },
			{ id: '03', label: 'One Push' },
			{ id: '05', label: 'Manual' },
			{ id: '20', label: 'VAR (color temperature)' },
		],
		'00',
	)
	actions.onepush_wb_trigger = simple('One-push White Balance Trigger', [0x01, 0x04, 0x10, 0x05])
	actions.colortemp_up = simple('Color Temperature Up', [0x01, 0x04, 0x20, 0x02])
	actions.colortemp_down = simple('Color Temperature Down', [0x01, 0x04, 0x20, 0x03])
	actions.colortemp_reset = simple('Color Temperature Reset', [0x01, 0x04, 0x20, 0x00])
	// V60 table: direct is a single raw byte (8x 01 04 20 00 xx FF), NOT the
	// 2-nibble encoding used on the VX-90 — exact index-to-Kelvin mapping is
	// not documented for this camera family, only that a raw byte 0-255 is sent.
	actions.colortemp_direct = byteAction(
		'Color Temperature',
		[0x01, 0x04, 0x20, 0x00],
		0,
		255,
		0,
		'Raw index 0-255. The index-to-Kelvin mapping is not documented for this camera family.',
	)

	// ---------- GAIN / R-GAIN / B-GAIN ----------
	// V60 table: direct is 2 nibble-bytes (pq) after a 5-byte prefix — finer
	// than the VX-90's single-nibble (0-10) encoding of the same command.
	actions.gain_direct = numberAction(
		'Gain',
		[0x01, 0x04, 0x0c, 0x00, 0x00],
		0,
		255,
		0,
		2,
		'0-255 (finer table on this camera family than on the VX-90)',
	)
	actions.gain_reset = simple('Gain Reset', [0x01, 0x04, 0x0c, 0x00])
	actions.gain_up = simple('Gain Up', [0x01, 0x04, 0x0c, 0x02])
	actions.gain_down = simple('Gain Down', [0x01, 0x04, 0x0c, 0x03])
	actions.gain_limit_direct = numberAction('Gain Limit', [0x01, 0x04, 0x2c], 0, 10, 10, 1, '0-10')
	actions.gain_limit_reset = simple('Gain Limit Reset', [0x0a, 0x11, 0x24, 0x00])
	actions.gain_limit_up = simple('Gain Limit Up', [0x0a, 0x11, 0x24, 0x02])
	actions.gain_limit_down = simple('Gain Limit Down', [0x0a, 0x11, 0x24, 0x03])
	actions.r_gain_direct = numberAction('R Gain', [0x01, 0x04, 0x43, 0x00, 0x00], 0, 255, 128, 2, '0-255')
	actions.r_gain_reset = simple('R Gain Reset', [0x01, 0x04, 0x03, 0x00])
	actions.r_gain_up = simple('R Gain Up', [0x01, 0x04, 0x03, 0x02])
	actions.r_gain_down = simple('R Gain Down', [0x01, 0x04, 0x03, 0x03])
	actions.b_gain_direct = numberAction('B Gain', [0x01, 0x04, 0x44, 0x00, 0x00], 0, 255, 128, 2, '0-255')
	actions.b_gain_reset = simple('B Gain Reset', [0x01, 0x04, 0x04, 0x00])
	actions.b_gain_up = simple('B Gain Up', [0x01, 0x04, 0x04, 0x02])
	actions.b_gain_down = simple('B Gain Down', [0x01, 0x04, 0x04, 0x03])

	// ---------- EXPOSURE ----------
	actions.exposure_mode = choiceAction(
		'Exposure: Mode',
		[0x01, 0x04, 0x39],
		[
			{ id: '0', label: 'Full Auto' },
			{ id: '3', label: 'Manual' },
			{ id: 'a', label: 'Shutter priority (SAE)' },
			{ id: 'b', label: 'Iris priority (AAE)' },
			{ id: 'd', label: 'Bright' },
		],
		'0',
	)
	actions.metering_mode = choiceAction(
		'Metering Mode',
		[0x01, 0x04, 0x3a],
		[
			{ id: '0', label: 'Average' },
			{ id: '1', label: 'Center-weighted' },
			{ id: '2', label: 'Smart' },
			{ id: '3', label: 'Top' },
		],
		'0',
	)
	actions.shutter_direct = numberAction('Shutter Position', [0x01, 0x04, 0x4a, 0x00, 0x00], 0, 0x11, 0, 2, '0-17')
	actions.shutter_reset = simple('Shutter Reset', [0x01, 0x04, 0x0a, 0x00])
	actions.shutter_up = simple('Shutter Up', [0x01, 0x04, 0x0a, 0x02])
	actions.shutter_down = simple('Shutter Down', [0x01, 0x04, 0x0a, 0x03])
	actions.iris_direct = numberAction('Iris Position', [0x01, 0x04, 0x4b, 0x00, 0x00], 0, 255, 0, 2, '0-255')
	actions.iris_reset = simple('Iris Reset', [0x01, 0x04, 0x0b, 0x00])
	actions.iris_up = simple('Iris Up (open)', [0x01, 0x04, 0x0b, 0x02])
	actions.iris_down = simple('Iris Down (close)', [0x01, 0x04, 0x0b, 0x03])
	actions.exposure_comp_mode = onOff('Exposure: Compensation On/Off', [0x01, 0x04, 0x3e])
	actions.exposure_comp_reset = simple('Exposure Compensation Reset', [0x01, 0x04, 0x0e, 0x00])
	actions.exposure_comp_up = simple('Exposure Compensation Up', [0x01, 0x04, 0x0e, 0x02])
	actions.exposure_comp_down = simple('Exposure Compensation Down', [0x01, 0x04, 0x0e, 0x03])
	// V60 table: direct is 2 nibble-bytes (pq) after a 5-byte prefix.
	actions.exposure_comp_direct = numberAction(
		'Exposure Compensation',
		[0x01, 0x04, 0x4e, 0x00, 0x00],
		0,
		255,
		0,
		2,
		'0-255 (raw value)',
	)
	actions.backlight = onOff('Backlight Compensation', [0x01, 0x04, 0x33])
	actions.drc_direct = numberAction('DRC', [0x01, 0x04, 0x25, 0x00, 0x00, 0x00], 0, 8, 0, 1, '0-8')
	actions.drc_reset = simple('DRC Reset', [0x01, 0x04, 0x25, 0x00])
	actions.drc_up = simple('DRC Up', [0x01, 0x04, 0x25, 0x02])
	actions.drc_down = simple('DRC Down', [0x01, 0x04, 0x25, 0x03])
	actions.anti_flicker = choiceAction(
		'Anti-Flicker',
		[0x01, 0x04, 0x23],
		[
			{ id: '0', label: 'Off' },
			{ id: '1', label: '50Hz' },
			{ id: '2', label: '60Hz' },
		],
		'1',
	)

	// ---------- IMAGE ----------
	// V60 table: Brightness/Contrast direct are 2 nibble-bytes (pq) after a
	// 5-byte prefix — the VX-90 uses a single-nibble (0-14) encoding instead.
	actions.brightness_direct = numberAction(
		'Brightness',
		[0x01, 0x04, 0xa1, 0x00, 0x00],
		0,
		255,
		0,
		2,
		'0-255 (finer table on this camera family than on the VX-90)',
	)
	actions.contrast_direct = numberAction(
		'Contrast',
		[0x01, 0x04, 0xa2, 0x00, 0x00],
		0,
		255,
		0,
		2,
		'0-255 (finer table on this camera family than on the VX-90)',
	)
	// CAM_Bright (separate from CAM_Brightness above) — also 2 nibble-bytes on this model.
	actions.bright_direct = numberAction(
		'Bright',
		[0x01, 0x04, 0x0d, 0x00, 0x00],
		0,
		255,
		0,
		2,
		'0-255 (finer table on this camera family than on the VX-90)',
	)
	actions.bright_reset = simple('Bright Reset', [0x01, 0x04, 0x0d, 0x00])
	actions.bright_up = simple('Bright Up', [0x01, 0x04, 0x0d, 0x02])
	actions.bright_down = simple('Bright Down', [0x01, 0x04, 0x0d, 0x03])
	// V60 table: Aperture(Sharpness) direct is also 2 nibble-bytes (pq).
	actions.sharpness_direct = numberAction(
		'Sharpness/Aperture',
		[0x01, 0x04, 0x42, 0x00, 0x00],
		0,
		255,
		0,
		2,
		'0-255 (finer table on this camera family than on the VX-90)',
	)
	actions.sharpness_reset = simple('Sharpness Reset', [0x01, 0x04, 0x02, 0x00])
	actions.sharpness_auto = simple('Sharpness: Auto', [0x01, 0x04, 0x05, 0x02])
	actions.sharpness_up = simple('Sharpness Up', [0x01, 0x04, 0x02, 0x02])
	actions.sharpness_down = simple('Sharpness Down', [0x01, 0x04, 0x02, 0x03])
	actions.saturation = numberAction(
		'Color Gain / Saturation',
		[0x01, 0x04, 0x49, 0x00, 0x00, 0x00],
		0,
		14,
		7,
		1,
		'0-14, 60%-200%',
	)
	actions.hue = {
		name: 'Color Hue (-7..+7 degrees)',
		options: [{ id: 'value', type: 'number', label: 'Hue', min: -7, max: 7, default: 0 }],
		callback: (event) => send([0x01, 0x04, 0x4f, 0x00, 0x00, 0x00, ...nibbleBytes(Number(event.options.value) + 7, 1)]),
	}
	actions.bw_mode = onOff('Black & White Mode', [0x01, 0x04, 0x63], 0x04, 0x00)
	actions.flip = choiceAction(
		'Flip (combined)',
		[0x01, 0x04, 0xa4],
		[
			{ id: '0', label: 'Off' },
			{ id: '1', label: 'Flip-H' },
			{ id: '2', label: 'Flip-V' },
			{ id: '3', label: 'Flip-HV' },
		],
		'0',
	)
	actions.flip_h = onOff('Horizontal Flip (LR Reverse)', [0x01, 0x04, 0x61])
	actions.flip_v = onOff('Vertical Flip', [0x01, 0x04, 0x66])
	// V60 table: 00 PC, 01 0.45, 02 0.5, 03 0.56, 04 0.63, 05 EXT — a
	// different mapping/order from the VX-90's gamma table.
	actions.gamma = choiceAction(
		'Gamma',
		[0x01, 0x04, 0x5b],
		[
			{ id: '0', label: 'PC' },
			{ id: '1', label: '0.45' },
			{ id: '2', label: '0.5' },
			{ id: '3', label: '0.56' },
			{ id: '4', label: '0.63' },
			{ id: '5', label: 'EXT' },
		],
		'0',
	)
	actions.nr2d_level = {
		name: 'NR2D Level (0=Off, 1-5)',
		options: [{ id: 'value', type: 'number', label: 'Level', min: 0, max: 5, default: 0 }],
		callback: (event) => send([0x01, 0x04, 0x53, Number(event.options.value) & 0x0f]),
	}
	actions.nr3d_level = {
		name: 'NR3D Level (0=Off, 1-5)',
		options: [{ id: 'value', type: 'number', label: 'Level', min: 0, max: 5, default: 0 }],
		callback: (event) => send([0x01, 0x04, 0x54, Number(event.options.value) & 0x0f]),
	}
	actions.image_freeze = onOff('Image Freeze', [0x01, 0x04, 0x62])

	// ---------- OSD MENU ----------
	actions.osd_turn_on = simple('OSD Menu: Turn On', [0x01, 0x06, 0x06, 0x02])
	actions.osd_turn_off = simple('OSD Menu: Turn Off', [0x01, 0x06, 0x06, 0x03])
	actions.osd_toggle = simple('OSD Menu: Turn On/Off Toggle', [0x01, 0x06, 0x06, 0x10])
	actions.osd_enter = simple('OSD Menu: Confirm', [0x01, 0x06, 0x06, 0x05])
	actions.osd_back = simple('OSD Menu: Go Back', [0x01, 0x06, 0x06, 0x04])

	// ---------- PAN/TILT ----------
	const panSpeedOpt = { id: 'panSpeed', type: 'number', label: 'Pan speed (1-24)', min: 1, max: 24, default: 12 }
	const tiltSpeedOpt = { id: 'tiltSpeed', type: 'number', label: 'Tilt speed (1-20)', min: 1, max: 20, default: 10 }

	const ptMove = (name, dirBytes) => ({
		name,
		options: [panSpeedOpt, tiltSpeedOpt],
		callback: (event) =>
			send([
				0x01,
				0x06,
				0x01,
				Number(event.options.panSpeed) & 0xff,
				Number(event.options.tiltSpeed) & 0xff,
				...dirBytes,
			]),
	})
	actions.pt_up = ptMove('Pan/Tilt: Up', [0x03, 0x01])
	actions.pt_down = ptMove('Pan/Tilt: Down', [0x03, 0x02])
	actions.pt_left = ptMove('Pan/Tilt: Left', [0x01, 0x03])
	actions.pt_right = ptMove('Pan/Tilt: Right', [0x02, 0x03])
	actions.pt_upleft = ptMove('Pan/Tilt: Up-Left', [0x01, 0x01])
	actions.pt_upright = ptMove('Pan/Tilt: Up-Right', [0x02, 0x01])
	actions.pt_downleft = ptMove('Pan/Tilt: Down-Left', [0x01, 0x02])
	actions.pt_downright = ptMove('Pan/Tilt: Down-Right', [0x02, 0x02])
	actions.pt_stop = ptMove('Pan/Tilt: Stop', [0x03, 0x03])
	actions.pt_absolute = {
		name: 'Pan/Tilt: Absolute Position',
		options: [
			panSpeedOpt,
			tiltSpeedOpt,
			{ id: 'pan', type: 'number', label: 'Pan position (signed)', min: -32768, max: 32767, default: 0 },
			{ id: 'tilt', type: 'number', label: 'Tilt position (signed)', min: -32768, max: 32767, default: 0 },
		],
		callback: (event) =>
			send([
				0x01,
				0x06,
				0x02,
				Number(event.options.panSpeed) & 0xff,
				Number(event.options.tiltSpeed) & 0xff,
				...signedNibbleBytes16(Number(event.options.pan)),
				...signedNibbleBytes16(Number(event.options.tilt)),
			]),
	}
	actions.pt_relative = {
		name: 'Pan/Tilt: Relative Position',
		options: [
			panSpeedOpt,
			tiltSpeedOpt,
			{ id: 'pan', type: 'number', label: 'Pan offset (signed)', min: -32768, max: 32767, default: 0 },
			{ id: 'tilt', type: 'number', label: 'Tilt offset (signed)', min: -32768, max: 32767, default: 0 },
		],
		callback: (event) =>
			send([
				0x01,
				0x06,
				0x03,
				Number(event.options.panSpeed) & 0xff,
				Number(event.options.tiltSpeed) & 0xff,
				...signedNibbleBytes16(Number(event.options.pan)),
				...signedNibbleBytes16(Number(event.options.tilt)),
			]),
	}
	actions.pt_home = simple('Pan/Tilt: Home', [0x01, 0x06, 0x04])
	actions.pt_reset = simple('Pan/Tilt: Reset', [0x01, 0x06, 0x05])
	actions.pt_limit_clear_downright = simple(
		'Pan/Tilt: Clear Limit (down-right unlock)',
		[0x01, 0x06, 0x07, 0x01, 0x01, 0x07, 0x0f, 0x0f, 0x0f, 0x07, 0x0f, 0x0f, 0x0f],
	)
	actions.pt_limit_clear_upleft = simple(
		'Pan/Tilt: Clear Limit (up-left unlock)',
		[0x01, 0x06, 0x07, 0x01, 0x00, 0x07, 0x0f, 0x0f, 0x0f, 0x07, 0x0f, 0x0f, 0x0f],
	)

	// ---------- PRESET ----------
	// V60 table documents preset numbers 0-127 (vs. 0-254 on the VX-90).
	actions.preset_set = byteAction('Preset: Set', [0x01, 0x04, 0x3f, 0x01], 0, 127, 0, '0-127')
	actions.preset_recall = byteAction('Preset: Recall', [0x01, 0x04, 0x3f, 0x02], 0, 127, 0, '0-127')
	actions.preset_clear = byteAction('Preset: Clear/Reset', [0x01, 0x04, 0x3f, 0x00], 0, 127, 0, '0-127')
	actions.preset_speed_up = simple('Preset: Recall Speed Up', [0x0a, 0x11, 0x35, 0x02])
	actions.preset_speed_down = simple('Preset: Recall Speed Down', [0x0a, 0x11, 0x35, 0x03])

	// ---------- TALLY ----------
	actions.tally_simple = {
		name: 'Tally: Colour',
		options: [
			{
				id: 'value',
				type: 'dropdown',
				label: 'State',
				default: '2',
				choices: [
					{ id: '1', label: 'Green LED on' },
					{ id: '2', label: 'Red LED on' },
					{ id: '3', label: 'Off (return to normal)' },
				],
			},
		],
		callback: (event) => send([0x01, 0x7e, 0x01, 0x0a, 0x00, parseInt(event.options.value, 16)]),
	}

	// ---------- TRACKING (V60 table explicitly lists the VX-90 as a shared
	// model for these commands, so they should also apply here) ----------
	actions.track_enable = onOff('Tracking: Enable Human Tracking', [0x0a, 0x11, 0x54])
	actions.track_target_select = choiceAction(
		'Tracking: Target Selection',
		[0x0a, 0x11, 0xa3],
		[
			{ id: '2', label: 'Left' },
			{ id: '3', label: 'Right' },
			{ id: '4', label: 'Confirm' },
		],
		'4',
	)
	actions.track_figure_size = choiceAction(
		'Tracking: Close-up Figure Size',
		[0x0a, 0x0f, 0x01, 0x00],
		[
			{ id: '0', label: 'Full Body' },
			{ id: '1', label: 'Half Body' },
			{ id: '2', label: 'Close Up' },
			{ id: '3', label: 'Custom' },
		],
		'0',
	)
	actions.track_mode = choiceAction(
		'Tracking: Mode',
		[0x0a, 0x01, 0x04, 0x1c],
		[
			{ id: '3', label: 'Tracking' },
			{ id: '4', label: 'Region' },
			{ id: '5', label: 'Frame' },
		],
		'3',
	)
	actions.voice_tracking = onOff('Voice Tracking', [0x0b, 0x02, 0x10])

	return actions
}

module.exports = { getActionDefinitions }
