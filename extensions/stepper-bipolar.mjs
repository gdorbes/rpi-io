// -------------------------------------------------------------------
// RPI-IO: BIPOLAR STEPPER MOTOR EXTENSION
// -------------------------------------------------------------------
import {RIO, traceCfg, log, warn, sleep, ctrlC} from "../esm/main.mjs"

export {RIO, traceCfg, log, warn, sleep, ctrlC}

/** ------------------------------------------------------------------
 * @class StepperBipolar
 * @description Class definition for Bipolar Stepper motors.
 * Bipolar stepper motors (e.g. NEMA 17 or 23) require hardware driver
 * such as DM542 or equilavent depending on motor power
 */
export class StepperBipolar {

    static STATUS_MSG = {
        0: "none",
        11: "pul or dir rpi-io instance definition is missing",
        12: "At least one rpi-io instance is not valid",
        13: "Wrong edge {'asc','desc'}",
        14: "Wrong pulse width (5 ≤ p ≤ 10,000,000)",
        200: "ok"
    }

    static EDGES = ["desc", "asc"]

    // Private method: Update instance status
    #setStatus(code, data) {
        this.status.code = code
        this.status.msg = StepperBipolar.STATUS_MSG[code]
        this.status.data = data
    }

    /** ------------------------------------------------------------------
     * @method constructor
     * @param {Object} pul           // rpi-io output instance for pulse pin
     * @param {Object} dir           // rpi-io output instance for direction pin
     * @param {"desc"|"asc"} edge    // pulse active edge: descending or ascending
     * @param {Number} width         // pulse width in µs between two edges
     */
    constructor(pul, dir, edge, width) {

        // Init instance construction status
        this.status = {
            code: 0,
            msg: StepperBipolar.STATUS_MSG[0],
            data: ""
        }

        // ERR11: pul or pir rpi-io instance definition is missing
        if (typeof pul === "undefined" || typeof dir === "undefined") {
            this.#setStatus(11, "")
            RIO.closeAll()
            return
        }

        // ERR12: At least one coil port rpi-io instance is not valid
        try {
            pul.write(0)
            dir.write(0)
        } catch (err) {
            this.#setStatus(12, "")
            RIO.closeAll()
            return
        }

        // ERR13: Wrong edge {'asc','desc'}
        if (StepperBipolar.EDGES.indexOf(edge) === -1) {
            this.#setStatus(13, edge)
            RIO.closeAll()
            return
        }

        // ERR14: Wrong pulse width (5 ≤ p ≤ 10,000,000)
        if (typeof width !== "number" || width < 5 || width > 10000000) {
            this.#setStatus(14, width)
            RIO.closeAll()
            return
        }

        // Test successfully completed  => Init properties
        this.ioPulse = pul
        this.ioDir = dir
        this.edge = edge
        this.width = width
        this.#setStatus(200, "")
    }

    /** ------------------------------------------------------------------
     * @method rotate
     * @description Rotate the motor a certain number of steps forward or backward.
     *              Full rotation depends on hardware driver settings.
     * @param {Number} steps
     * @param {"forward"|"backward"} direction
     * @return {Promise<{elapsedMs: number, pulsesCompleted: number, stopped: boolean}>}
     */
    async rotate(steps, direction) {

        // Set direction
        this.ioDir.write("forward" ? 1 : 0)

        // Start rotation
        log("starting rotation:", steps, "steps", direction)
        return await this.ioPulse.pulseStart(steps, this.edge, {
            pulseWidth: this.width,
            spaceWidth: this.width,
        })
    }

    /** ------------------------------------------------------------------
     * @method stop
     * @description Immediately interrupts an ongoing pulse sequence if one is in progress.
     */
    stop() {
        this.ioPulse.pulseStop()
    }

    /** ------------------------------------------------------------------
     * @method close
     * @description Disable pul and ir rpi-io instances used for this step motor controller
     */
    close() {
        this.ioPulse.close
        this.ioDir.close
        log("Bipolar controller closed")
    }
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------