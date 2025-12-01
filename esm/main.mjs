// -------------------------------------------------------------------
// RPI-IO: Nodejs GPIO control module
// -------------------------------------------------------------------
import {createRequire} from "node:module"
import {writeFileSync} from "node:fs"
import {traceCfg, log, warn} from "./log.mjs"
import {sleep, ctrlC,lineNumber} from "./ctl.mjs"
import {wait, lineConfig} from "./nut.mjs"

export {traceCfg, log, warn, sleep, ctrlC, lineConfig, lineNumber}
// -------------------------------------------------------------------
//  CONSTANTS + VARIABLES
// -------------------------------------------------------------------
const require = createRequire(import.meta.url)
const ADDON = require("../build/Release/gpio.node")
const CHIPNAME = "/dev/gpiochip0"
const RPi_GPIO_STD = [4, 5, 6, 16, 17, 20, 21, 22, 23, 24, 25, 26, 27]
const RPi_GPIO_PWM = [12, 13, 18, 19]
const RPI_GPIO_ALL = [...RPi_GPIO_STD, ...RPi_GPIO_PWM]
const RPI_CHIP = "gpiochip0"
const PWM_CHIP = "pwmchip0"

// -------------------------------------------------------------------
// CLASS RIO & METHODS
/** ------------------------------------------------------------------
 * @class RIO
 * @classDesc Generic class manage GPIO lines
 * @return {String}
 */
export class RIO {

    static instances = new Map()

    /** ------------------------------------------------------------------
     * @method constructor
     * @param {Number} line - BCM number
     * @param {String} mode - "input", "output", "pwm"
     * @param {Object} opt - misc options depending on mode
     */
    constructor(line, mode, opt) {

        const defopt = {
            // output
            value: 0, // Initial value
            // input, output
            bias: "disable", // "disable", "pull-up", "pull-down"
            // pwm
            exportTime: 100,
            period: 20000, // μs ~50Hz
            dutyMin: 0, // μs
            dutyMax: 20000 // µs
        }
        opt = {...defopt, ...opt}

        if (RPI_GPIO_ALL.indexOf(line) === -1)
            throw new Error("This line is not supported: " + line)

        // line is already defined
        if (RIO.instances.has(line))
            throw new Error("This line is already defined: " + line)

        this.line = line
        this.handle = null
        this.mode = mode
        this.value = opt.value
        this.bias = opt.bias
        this.closed = false // Instance status
        this.monitoring = false // Monitoring status
        this.config = lineConfig(this.line) // Required for pwm
        this.pwmExported = false
        this.pwmEnabled = false

        switch (this.mode) {
            case "output":
                this.handle = ADDON.openOutput(CHIPNAME, line, this.value, opt.bias)
                break
            case "input":
                this.handle = ADDON.openInput(CHIPNAME, line, opt.bias)
                break
            case "pwm":
                if (RPi_GPIO_PWM.indexOf(line) === -1)
                    throw new Error("This line is not supported for PWM: " + line)

                if (this.config.indexOf("pwm") === -1)
                    throw new Error("This line is not setup as PWM (see README)")

                if (opt.period < 0.1 || opt.period > 1000000)
                    throw new Error("PWM period is out of range (100ns - 1s)")

                // Normalize PWM values in ns
                this.period = opt.period * 1000
                this.dutyMin = Math.max(0, opt.dutyMin * 1000)
                this.dutyMax = Math.min(this.period, opt.dutyMax * 1000)

                // PWM channel: 0 or 1
                this.pwmChannel = this.config.slice(-1)
                this.pwmPath = "/sys/class/pwm/" + PWM_CHIP + "/"
                this.pwmPathChannel = this.pwmPath + "pwm" + this.pwmChannel + "/"

                log("pwm channel", this.pwmChannel, "normalized data (period, duty min, duty max):", this.period, this.dutyMin, this.dutyMax)

                // Export channel
                writeFileSync(this.pwmPath + "export", this.pwmChannel)
                this.pwmExported = true
                wait(opt.exportTime) // Customization required for RPi Zero

                // Set period, reset duty and enable
                try {
                    writeFileSync(this.pwmPathChannel + "period", String(this.period))
                    writeFileSync(this.pwmPathChannel + "duty_cycle", String(this.dutyMin))
                    writeFileSync(this.pwmPathChannel + "enable", "1")
                    this.pwmEnabled = true

                } catch (err) {
                    warn("pwm start error:", err)
                    warn("consider increasing option exportTime for this device ")
                    this.pwmStop()
                }

                break
            default:
                throw new Error("undefined mode")
        }

        // Everything OK => Add this to instance list
        RIO.instances.set(line, this)
    }

    /** ------------------------------------------------------------------
     * @method close
     * @description To close line and free resources
     */
    close() {
        if (this.closed) {
            warn("this instance is already closed")
            return
        }


        // Stop monitoring if active
        if (this.monitoring)
            this.monitoringStop()

        // Free C resources and reset handle
        if (this.handle) {
            ADDON.close(this.handle)
            this.handle = null
        }

        // Stop PWM if required
        if (this.mode === "pwm")
            this.pwmStop()

        // Delete from instance list et reset flag
        RIO.instances.delete(this.line)
        this.closed = true
        log("line", this.line, "is closed")
    }

    /** ------------------------------------------------------------------
     * @method write
     * @description Write value to GPIO line
     * @param {Number}  value
     */
    write(value) {

        if (this.closed)
            throw new Error("GPIO handle has been closed")

        if (this.mode !== "output")
            throw new Error("Cannot write to this GPIO mode:", this.mode)

        if ([0, 1].indexOf(value) === -1)
            throw new Error("Value must be either 0 or 1")

        ADDON.write(this.handle, value)
    }

    /** ------------------------------------------------------------------
     * @method read
     * @description Read value from GPIO line
     * @return {Number} 0,1
     */
    read() {
        if (this.closed)
            throw new Error("GPIO handle has been closed")

        if (this.mode !== "input")
            throw new Error("Cannot read from this GPIO mode:", this.mode)

        return ADDON.read(this.handle)
    }

    /** ------------------------------------------------------------------
     * @method monitoringStart
     * @description Monitor input GPIO line events (rising/falling)
     * @param {Function} callback 0,1
     * @param {String} edge
     * @param {Number} bounce
     */
    monitoringStart(callback, edge = "both", bounce = 0) {
        if (this.closed)
            throw new Error("GPIO handle has been closed")

        if (this.mode !== "input")
            throw new Error("Cannot read from this GPIO mode:", this.mode)

        if (this.monitoring)
            throw new Error("Monitoring already started")

        bounce < 0 ? bounce = 0 : false
        bounce > 1000 ? bounce = 1000 : false
        this.latestEvent = {
            time: new Date(null),
            edge: "none"
        }

        ADDON.startMonitoring(this.handle, value => {
            const evt = value === 1 ? "rising" : "falling"
            const now = new Date()
            const delta = Math.max(1, now - this.latestEvent.time) // delta is always > 0ms

            // Bounce detected
            if (delta <= bounce && evt === this.latestEvent.edge) {
                log("bounce detected on gpio", this.line, evt, delta + "ms")
            }
            // Callback of required events
            else {
                if (typeof callback === "function" && (edge === "both" || edge === evt)) {
                    callback(evt)
                }
            }
            // Update latest event
            this.latestEvent = {
                time: now,
                edge: evt
            }
        })
        this.monitoring = true
    }

    /** ------------------------------------------------------------------
     * @method monitoringStop
     * @description Stop event monitoring
     */
    monitoringStop() {
        if (this.closed)
            return

        if (this.monitoring) {
            ADDON.stopMonitoring(this.handle)
            this.monitoring = false
        }
    }

    /** --------------------------------------------------------------
     * @method pwmStop
     * @description Stop PWM modulation
     */
    pwmStop() {

        if (this.mode !== "pwm")
            throw new Error("This line is not configured as PWM")

        if (this.pwmEnabled) {
            writeFileSync(this.pwmPathChannel + "enable", "0")
            this.pwmEnabled = false
        }

        if (this.pwmExported) {
            writeFileSync(this.pwmPath + "unexport", this.pwmChannel)
            this.pwmExported = false
        }
    }

    /** --------------------------------------------------------------
     * @method pwmDuty
     * @description Change PWM duty cycle
     * @param {Number} percent 0 <= percent  <= 100
     */
    pwmDuty(percent) {

        if (this.mode !== "pwm")
            throw new Error("This line is not configured as PWM")

        if (!this.pwmEnabled || !this.pwmExported)
            throw new Error("Duty of PWM line " + this.line + " cannot be updated")

        if (percent < 0 || percent > 100 || typeof percent !== "number") {
            throw new Error("Duty value (%) of PWM line" + this.line + " is not valid")
        }

        writeFileSync(this.pwmPathChannel + "duty_cycle", (this.dutyMin + ((percent / 100) * (this.dutyMax - this.dutyMin))).toString())
    }

    /** ------------------------------------------------------------------
     * @method RIO.closeAll
     * @description Static method to close all instances
     */
    static closeAll() {
        for (const [line, instance] of RIO.instances) {
            instance.close()
        }
    }
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------
