// -------------------------------------------------------------------
// RPI-IO: STEP MOTOR EXTENSION ⚠️ Work in Progress
// -------------------------------------------------------------------
import {RIO} from "./main.mjs";
// -------------------------------------------------------------------
// UTILITY FUNCTIONS
/** ------------------------------------------------------------------
 * @function tlog
 * @description Timestamped console.log
 */
export function tlog() {
    const date = new Date()
    const nowMs = date.toLocaleTimeString() + "." + date.getMilliseconds().toLocaleString('en', {
        minimumIntegerDigits: 3,
        minimumFractionDigits: 0,
        useGrouping: false
    })
    console.log.apply(console, Array.prototype.concat.apply([nowMs, "🔎 "], arguments))
}

/** ------------------------------------------------------------------
 * @function wait
 * @description Wait ms as a promise and optional tlog
 * @param {Number} ms
 * @param {Boolean} logWait
 */
export function wait(ms, logWait = true) {
    logWait ? tlog("sleeping", ms, "ms") : false
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class STEP {

    static STATUS_MSG = {
        0: "none",
        1: "Unknown driver name",
        11: "At least one coil port rpi-io instance definition is missing",
        12: "At least one coil port rpi-io instance is not valid",
        13: "Wrong delay parameter value (0 ≤ d ≤ 1000)",
        14: "Wrong ULN2003 sequence {'full','half'}",
        200: "ok"
    }
    static ULN2003_MODE = ["half", "full"]
    static ULN2003_STEPS = {
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
        this.status.msg = STEP.STATUS_MSG[code]
        this.status.data = data
    }

    /** ------------------------------------------------------------------
     * @method constructor
     * @param {String} driver       // Supported driver name
     * @param {Object} rios         // rpi-io Instance container depending on driver
     * @param {Object} opt          // Options depending on driver
     */
    constructor(driver, rios, opt) {

        const defopt = {
            // Parameters for ULN2003
            delay: 10,
            sequence: "half"
        }
        opt = {...defopt, ...opt}

        // Init instance construction status
        this.status = {
            code: 0,
            msg: STEP.STATUS_MSG[0],
            data: ""
        }

        // Test parameters depending on driver
        switch (driver) {
            case "uln2003":

                // ERR11: At least one coil port rpi-io instance definition is missing
                if (typeof rios.coilA === "undefined" || typeof rios.coilB === "undefined" || typeof rios.coilC === "undefined" || typeof rios.coilD === "undefined") {
                    this.#setStatus(11, "")
                    RIO.closeAll()
                    return
                }

                // ERR12: At least one coil port rpi-io instance is not valid
                try {
                    rios.coilA.write(0)
                    rios.coilB.write(0)
                    rios.coilC.write(0)
                    rios.coilD.write(0)
                } catch (err) {
                    this.#setStatus(12, "")
                    RIO.closeAll()
                    return
                }

                // ERR13: Wrong delay parameter value (0 ≤ d ≤ 1000)
                if (typeof opt.delay !== "number" || opt.delay < 0 || opt.delay > 1000) {
                    this.#setStatus(13, opt.delay)
                    RIO.closeAll()
                    return
                }

                // ERR14: Wrong ULN2003 sequence {'full','half'}
                if (STEP.ULN2003_MODE.indexOf(opt.sequence) === -1) {
                    this.#setStatus(14, opt.sequence)
                    RIO.closeAll()
                    return
                }

                // Test successfully completed  => Init properties
                this.driver = "uln2003"
                this.props = {
                    a: rios.coilA,
                    b: rios.coilB,
                    c: rios.coilC,
                    d: rios.coilD,
                    sequence: STEP.ULN2003_STEPS[opt.sequence],
                    len: STEP.ULN2003_STEPS[opt.sequence].length,
                    delay: opt.delay,
                    inc: 0,
                    index: 0
                }
                this.#setStatus(200, "")
                break
            default:
                this.#setStatus(1, driver)
        }
    }

    /** ------------------------------------------------------------------
     * @method rotate
     * @description Rotate the motor a certain number of steps forward or backward.
     *              A full rotation consists of 200 steps.
     * @param {Number} steps
     * @param {"forward"|"backward"} direction
     * @param {Boolean} showStep
     */
    async rotate(steps, direction, showStep = false) {

        switch (this.driver) {
            case "uln2003":
                this.props.inc = direction === "forward" ? 1 : -1

                tlog("starting rotation:", steps, "steps", direction)

                // Rotate
                for (let i = 0; i < steps; i++) {
                    const [a, b, c, d] = this.props.sequence[this.props.index]
                    if (showStep) {
                        tlog("rotation step:", i, [a, b, c, d])
                    }
                    this.props.a.write(a)
                    this.props.b.write(b)
                    this.props.c.write(c)
                    this.props.d.write(d)

                    this.props.index = ((this.props.index + this.props.inc) % this.props.len + this.props.len) % this.props.len
                    await wait(this.props.delay, false)
                }

                // Disable coils
                this.props.a.write(0)
                this.props.b.write(0)
                this.props.c.write(0)
                this.props.d.write(0)
        }
    }

    /** ------------------------------------------------------------------
     * @method close
     * @description Disable coils and close rpi-io instances used for step motor controller
     */
    close() {

        switch (this.driver) {
            case "uln2003":
                this.props.a.write(0)
                this.props.b.write(0)
                this.props.c.write(0)
                this.props.d.write(0)
                this.props.a.close()
                this.props.b.close()
                this.props.c.close()
                this.props.d.close()
                tlog("ULN2003 controller closed")
        }
    }
}


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------