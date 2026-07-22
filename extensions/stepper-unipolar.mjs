// -------------------------------------------------------------------
// RPI-IO: UNIPOLAR STEPPER MOTOR EXTENSION
// -------------------------------------------------------------------
import {RIO, traceCfg, log, warn, sleep} from "../esm/main.mjs"

export {RIO, traceCfg, log, warn, sleep}

/** ------------------------------------------------------------------
 * @class StepperUnipolar
 * @description Class definition for Unipolar Stepper motors.
 * Unipolar stepper motors (e.g. 28BYJ-48) are directly controlled by  RPi using
 * a Darlington Transistor Array (e.g. ULN2003)
 */
export class StepperUnipolar {

    static STATUS_MSG = {
        0: "none",
        11: "At least one coil port rpi-io instance definition is missing",
        12: "At least one coil port rpi-io instance is not valid",
        13: "Wrong delay parameter value (0 ≤ d ≤ 1000)",
        14: "Wrong Unipolar sequence {'full','half'}",
        200: "ok"
    }
    static MODE = ["half", "full"]
    static STEPS = {
        half: [
            [1, 0, 0, 0],
            [1, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 1, 0],
            [0, 0, 1, 0],
            [0, 0, 1, 1],
            [0, 0, 0, 1],
            [1, 0, 0, 1]
        ],
        full: [
            [1, 0, 0, 1],
            [1, 1, 0, 0],
            [0, 1, 1, 0],
            [0, 0, 1, 1]
        ]
    }

    // Private method: Update instance status
    #setStatus(code, data) {
        this.status.code = code
        this.status.msg = StepperUnipolar.STATUS_MSG[code]
        this.status.data = data
    }

    /** ------------------------------------------------------------------
     * @method constructor
     * @param {Object} coilA         // rpi-io output instance for CoilA
     * @param {Object} coilB         // rpi-io output instance for CoilB
     * @param {Object} coilC         // rpi-io output instance for CoilC
     * @param {Object} coilD         // rpi-io output instance for CoilD
     * @param {"half"|"ful"} mode    // Full or half step sequence
     * @param {Number} delay         // Delay between steps in ms
     */
    constructor(coilA, coilB, coilC, coilD, mode = "half", delay = 10) {

        // Init instance construction status
        this.status = {
            code: 0,
            msg: StepperUnipolar.STATUS_MSG[0],
            data: ""
        }

        // ERR11: At least one coil port rpi-io instance definition is missing
        if (typeof coilA === "undefined" || typeof coilB === "undefined" || typeof coilC === "undefined" || typeof coilD === "undefined") {
            this.#setStatus(11, "")
            RIO.closeAll()
            return
        }

        // ERR12: At least one coil port rpi-io instance is not valid
        try {
            coilA.write(0)
            coilB.write(0)
            coilC.write(0)
            coilD.write(0)
        } catch (err) {
            this.#setStatus(12, "")
            RIO.closeAll()
            return
        }

        // ERR13: Wrong delay parameter value (0 ≤ d ≤ 1000)
        if (typeof delay !== "number" || delay < 0 || delay > 1000) {
            this.#setStatus(13, delay)
            RIO.closeAll()
            return
        }

        // ERR14: Wrong mode {'full','half'}
        if (StepperUnipolar.MODE.indexOf(mode) === -1) {
            this.#setStatus(14, mode)
            RIO.closeAll()
            return
        }

        // Test successfully completed  => Init properties
        this.coils = {
            a: coilA,
            b: coilB,
            c: coilC,
            d: coilD,
        }
        this.sequence = StepperUnipolar.STEPS[mode]
        this.len = this.sequence.length
        this.delay = delay
        this.index = 0
        this.increment = 0
        this.#setStatus(200, "")
    }

    /** ------------------------------------------------------------------
     * @method rotate
     * @description Rotate the motor a certain number of steps forward or backward.
     *              Full rotation depends on selected mode.
     * @param {Number} steps
     * @param {"forward"|"backward"} direction
     * @param {Boolean} showStep
     */
    async rotate(steps, direction, showStep = false) {

        this.increment = direction === "forward" ? 1 : -1

        log("starting rotation:", steps, "steps", direction)

        // Rotate
        for (let i = 0; i < steps; i++) {
            const [a, b, c, d] = this.sequence[this.index]
            if (showStep) {
                log("rotation step:", i, [a, b, c, d])
            }
            this.coils.a.write(a)
            this.coils.b.write(b)
            this.coils.c.write(c)
            this.coils.d.write(d)

            this.index = ((this.index + this.increment % this.len + this.len) % this.len)
            await sleep(this.delay, false)
        }

        // Disable coils
        this.coils.a.write(0)
        this.coils.b.write(0)
        this.coils.c.write(0)
        this.coils.d.write(0)
    }

    /** ------------------------------------------------------------------
     * @method close
     * @description Disable coils and close rpi-io instances used for this step motor controller
     */
    close() {
        this.coils.a.write(0)
        this.coils.b.write(0)
        this.coils.c.write(0)
        this.coils.d.write(0)
        this.coils.a.close()
        this.coils.b.close()
        this.coils.c.close()
        this.coils.d.close()
        log("Unipolar controller closed")
    }
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------