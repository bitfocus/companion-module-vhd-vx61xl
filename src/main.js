const { InstanceBase, runEntrypoint, InstanceStatus, Regex } = require('@companion-module/base')
const net = require('net')
const { UpgradeScripts } = require('./upgrades')
const { getActionDefinitions } = require('./actions')
const { getFeedbackDefinitions } = require('./feedbacks')
const { getPresetDefinitions } = require('./presets')

const CONNECT_TIMEOUT_MS = 5000

class VX61XLInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.socket = null
		this.reconnectTimer = null
		this.connected = false
		this.badConfig = false
		this.lastError = null
	}

	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		this.setActionDefinitions(getActionDefinitions(this))
		this.setFeedbackDefinitions(getFeedbackDefinitions(this))
		this.setPresetDefinitions(getPresetDefinitions(this))
		this.setVariableDefinitions([{ variableId: 'connection_status', name: 'Connection status' }])
		this.setVariableValues({ connection_status: 'Connecting' })
		this.initConnection()
	}

	async configUpdated(config) {
		this.config = config
		// Presets contain the connection label, so send them again.
		this.setPresetDefinitions(getPresetDefinitions(this))
		this.destroyConnection()
		this.initConnection()
	}

	async destroy() {
		this.destroyConnection()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'Controls a VHD VX61XL / V60-family PTZ camera over VISCA-over-IP (TCP). ' +
					'Default port is 5678 (see the camera network settings, "PTZ port"). ' +
					'Default VISCA camera address is 1. ' +
					'Command set built from VHD\'s official "Command list EN VHD V60" VISCA table.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Camera IP address',
				width: 6,
				regex: Regex.IP,
			},
			{
				type: 'number',
				id: 'port',
				label: 'VISCA TCP port',
				width: 3,
				min: 1,
				max: 65535,
				default: 5678,
			},
			{
				type: 'number',
				id: 'address',
				label: 'VISCA camera address',
				width: 3,
				min: 1,
				max: 7,
				default: 1,
			},
		]
	}

	/** Connection state changed: refresh every button that uses the `connected` feedback. */
	setConnected(value) {
		this.connected = value
		this.checkFeedbacks('connected')
	}

	/** Tear down the current socket (if any) without touching a pending reconnect timer. */
	destroySocket() {
		if (!this.socket) return
		const socket = this.socket
		this.socket = null
		socket.removeAllListeners()
		// A destroyed socket can still emit a late 'error'; swallow it so it never crashes the module.
		socket.on('error', () => {})
		try {
			socket.destroy()
		} catch (e) {
			// ignore
		}
	}

	initConnection() {
		// A reconnect must never leave the previous socket and its listeners behind.
		this.destroySocket()

		if (!this.config?.host) {
			this.badConfig = true
			this.setConnected(false)
			this.updateStatus(InstanceStatus.BadConfig, 'No camera IP configured')
			this.setVariableValues({ connection_status: 'No camera IP configured' })
			return
		}
		this.badConfig = false
		this.lastError = null

		const socket = new net.Socket()
		this.socket = socket

		// Without this, an unreachable IP keeps the status on "Connecting" for the OS TCP timeout
		// (often more than a minute) and the 5 s reconnect never runs.
		socket.setTimeout(CONNECT_TIMEOUT_MS)

		socket.on('connect', () => {
			socket.setTimeout(0) // the timeout is for connecting only, not for idle connections
			this.lastError = null
			this.setConnected(true)
			this.updateStatus(InstanceStatus.Ok)
			this.setVariableValues({ connection_status: 'Connected' })
		})

		socket.on('timeout', () => {
			// destroy(err) emits 'error' and then 'close', so the normal error/reconnect path runs.
			socket.destroy(new Error(`Connection timed out after ${CONNECT_TIMEOUT_MS / 1000} s`))
		})

		socket.on('error', (err) => {
			this.lastError = err.message
			this.setConnected(false)
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.setVariableValues({ connection_status: 'Error: ' + err.message })
			this.scheduleReconnect()
		})

		socket.on('close', () => {
			this.setConnected(false)
			// Node emits 'close' right after 'error'; keep the error message visible in that case.
			if (!this.badConfig && !this.lastError) {
				this.updateStatus(InstanceStatus.Disconnected)
				this.setVariableValues({ connection_status: 'Disconnected' })
			}
			this.scheduleReconnect()
		})

		socket.on('data', (data) => {
			// VISCA ACK/completion/error packets could be parsed here if needed later.
			this.log('debug', 'RX: ' + data.toString('hex'))
		})

		socket.connect(this.config.port || 5678, this.config.host)
	}

	scheduleReconnect() {
		if (this.reconnectTimer) return
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			if (!this.connected) this.initConnection()
		}, 5000)
	}

	destroyConnection() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.destroySocket()
		this.setConnected(false)
	}

	/** Send a pre-built VISCA Buffer to the camera. */
	sendBuffer(buf) {
		if (!this.socket || !this.connected) {
			this.log('warn', 'Not connected, dropping command: ' + buf.toString('hex'))
			return false
		}
		this.log('debug', 'TX: ' + buf.toString('hex'))
		this.socket.write(buf, (err) => {
			if (err) this.log('error', 'Write failed: ' + err.message)
		})
		return true
	}

	get viscaAddress() {
		return this.config?.address ?? 1
	}
}

runEntrypoint(VX61XLInstance, UpgradeScripts)
