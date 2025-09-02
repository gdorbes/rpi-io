// -------------------------------------------------------------------
// RPi GPIO CONTROL (based on libgpiod)
// -------------------------------------------------------------------
import {exec, execFile, spawn} from "child_process"
import {promisify} from "util"

// -------------------------------------------------------------------
// CONSTANTS AND VARIABLES
// -------------------------------------------------------------------
const IO_CHIP = "gpiochip0"
const IO_BCM_STD = [4, 5, 6, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
const IO_BCM_PWM = [12, 13]

export let debug = true
// -------------------------------------------------------------------
// UTILITIES
/** ------------------------------------------------------------------
 * @function log
 * @description Global customized timestamped console.log
 *              Requires global variable `debug`
 */
export const log = function () {

    if (debug) {
        const date = new Date()
        const now = date.toLocaleTimeString() + "." + date.getMilliseconds().toLocaleString('en', {
            minimumIntegerDigits: 3,
            minimumFractionDigits: 0,
            useGrouping: false
        })
        console.log.apply(console, Array.prototype.concat.apply([now, "🔎"], arguments))
    }
}

/** ------------------------------------------------------------------
 * @function sleep
 * @description Wait before continuing
 * @param {Number} ms
 */
export const sleep = ms => {
    log("sleep", ms)
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** ------------------------------------------------------------------
 * @function isRPi
 * @description Check RPI hardware
 * @return {Boolean}
 */
export const isRPi = () => {
    try {
        const cpuInfo = fs.readFileSync("/proc/cpuinfo", "utf8")
        return /Raspberry Pi/i.test(cpuInfo);
    } catch (err) {
        return false;
    }
}

// -------------------------------------------------------------------
// COMMAND AND FILE EXEC
/** ------------------------------------------------------------------
 * @function exeShell
 * @description Async run command in Linux shell
 * @param {String} cmd
 * @return {Object} {msg: 'ok', data: 'any result} or
 *                  {msg: 'error message', data: 'any error'}
 */
const exeShell = async cmd => {
    const execAsync = promisify(exec)

    try {
        const {stdout, stderr} = await execAsync(cmd)
        if (stderr) {
            return {
                msg: "exec error",
                data: stderr
            }
        } else {
            return {
                msg: "ok",
                data: stdout
            }
        }
    } catch (error) {
        return {
            msg: "exec catched error",
            data: error
        }
    }
}

/** ------------------------------------------------------------------
 * @function exeFile
 * @description Async run executable file
 * @param {String} file
 * @param {Array} args
 * @return {Object} {msg: 'ok', data: 'any result} or
 *                  {msg: 'error message', data: 'any error'}
 */
const exeFile = async (file, args) => {
    const execFileAsync = promisify(execFile)

    try {
        const {stdout, stderr} = await execFileAsync(file, args);
        if (stderr) {
            return {
                msg: "execFile error",
                data: stderr
            }
        } else {
            return {
                msg: "ok",
                data: stdout
            }
        }
    } catch (error) {
        return {
            msg: "execFile catched error",
            data: error
        }
    }
}

// -------------------------------------------------------------------
// GPIO COMMANDS
// See https://libgpiod.readthedocs.io/en/stable/gpio_tools.html
/** ------------------------------------------------------------------
 * @function ioDetect
 * @description See 'man gpiodetect'
 *  @return {Object} {msg: 'ok', data: stdout} or
 *                     {msg: 'error message', data: 'any error'}
 */
export const ioDetect = async () => {
    const detect = await exeFile("gpiodetect")
    detect.msg === "ok" ? log("gpiodetect data:", detect.data) : log("gpiodetect error:", detect.msg, detect.data)
    return detect
}

/** ------------------------------------------------------------------
 * @function ioVersion
 * @description Libgpiod version
 * @return {String}
 */
export const ioVersion = async () => {
    const detected = await exeShell("gpiodetect -v")
    if (detected.msg !== "ok")
        return "undefined"
    else
        return detected.data.split("\n").shift().substring(22).trim()
}

/** ------------------------------------------------------------------
 * @function ioInfo
 * @description See 'man gpioinfo'
 * @param {String} chip - optional chip name
 * @return {Object} {msg: 'ok', data: stdout} or
 *                   {msg: 'error message', data: 'any error'}
 */
export const ioInfo = async chip => {
    let args = []
    chip ? args[0] = chip : false
    const info = await exeFile("gpioinfo", args)
    info.msg === "ok" ? log("gpioinfo data:", info.data) : log("gpioinfo error:", info.msg, info.data)
    return info
}

/** ------------------------------------------------------------------
 * @function ioSet
 * @description gpioset
 * @param {Number} pin
 * @param {Number} value
 * @param {Object} opt
 * @return {Promise}
 */
const ioSet = async (pin, value, opt) => {

    const defopt = {
        chip: IO_CHIP
    }
    opt = {...defopt, ...opt}

    let args = [opt.chip, pin.toString() + "=" + value.toString()]
    return await exeFile("gpioset", args)
}
/** ------------------------------------------------------------------
 * @function ioGet
 * @description gpioget
 * @param {Number} pin
 * @param {Object} opt
 * @return {Promise}
 */
const ioGet = async (pin, opt) => {

    const defopt = {
        chip: IO_CHIP
    }
    opt = {...defopt, ...opt}

    let args = [opt.chip, pin.toString()]
    const result = await exeFile("gpioget", args)
    if (result.msg === "ok") {
        result.data = parseInt(result.data.replace(/\r?\n|\r/, ""))
    }
    return result
}

// -------------------------------------------------------------------
// CLASS RIO AND SUB CLASSES
/** ------------------------------------------------------------------
 * @class RIO
 * @classDesc Root class for all GPIO subclasses
 * @param {Number} bcm - GPIO Broadcom~number
 */
class RIO {
    static cbmAll = [...IO_BCM_STD, ...IO_BCM_PWM]
    static cbmUsed = []


    /** --------------------------------------------------------------
     * @function constructor
     * @description Create instance with BCM pin and stored it in
     *              class array.
     *              In case of error, this.bcm = -1.
     * @param {Number} bcm
     * @return {Object}
     */
    constructor(bcm) {

        // Not a RPi device device
        if (!hw.isRPi()) {
            this.bcm = -1
            log("not a RPi device")
            return
        }

        // BCM is not supported
        if (RIO.cbmAll.indexOf(bcm) === -1) {
            this.bcm = -1
            log("gpio", bcm, "is not supported")
            return
        }

        // BCM is already used
        if (RIO.cbmUsed.indexOf(bcm) !== -1) {
            this.bcm = -1
            log("gpio", bcm, "is already used")
            return
        }

        // Nominal situation
        this.bcm = bcm
    }

    /** --------------------------------------------------------------
     * @function disable
     * @description Remove instance bcm from RIO.cbmUsed =>
     *              Further operation with instance will fail
     */
    disable() {
        const i = RIO.cbmUsed.indexOf(this.bcm)

        if (i > -1) {
            RIO.cbmUsed.splice(i, 1)
            log("gpio", this.bcm, "has been disabled")
            return true
        } else {
            log("gpio", this.bcm, "not found")
            return false
        }
    }
}

/** ------------------------------------------------------------------
 * @class RpiOut
 * @classDesc Class to define and use GPIO pin for 'out' operations
 * @param {Number} bcm - GPIO Broadcom~number
 */

export class RpiOut extends RIO {

    constructor(bcm) {

        // Check BCM error with main constructor
        super(bcm)
        if (this.bcm === -1) {
            log("instance creation for output", bcm, "failed")
            return
        }

        // Add BCM to list of used IO
        RIO.cbmUsed.push(this.bcm)
        this.type = "out"
        log("gpio", bcm, "output instance creation is successful")
    }

    /** --------------------------------------------------------------
     * @function #gpioset
     * @description Private method to set GPIO to 0 1
     * @param {Number} value
     * @return {Promise} 'ok' or error message
     */
    async #gpioset(value) {
        if (RIO.cbmUsed.indexOf(this.bcm) === -1) {
            this.bcm = -1
            log("gpio", this.bcm, "is not enabled")
            return "pin " + this.bcm + " for output operations"
        }

        const result = await ioSet(this.bcm, value)
        if (result.msg === "ok") {
            log("gpio", this.bcm, "set to", value)
            return "ok"
        } else {
            log("gpio", this.bcm, "set error:", result.data)
            return result.data
        }
    }

    async set() {
        return this.#gpioset(1)
    }

    async reset() {
        return this.#gpioset(0)
    }
}

/** ------------------------------------------------------------------
 * @class RpiIn
 * @classDesc Class to define and use GPIO pin for 'in' operations
 * @param {Number} bcm - GPIO Broadcom~number
 */

export class RpiIn extends RIO {

    constructor(bcm) {

        // Check BCM error with main constructor
        super(bcm)
        if (this.bcm === -1) {
            log("instance creation for input", bcm, "failed")
            return
        }

        // Add BCM to list of used IO
        RIO.cbmUsed.push(this.bcm)
        this.type = "in"
        log("gpio", bcm, "input instance creation is successful")
    }

    /** --------------------------------------------------------------
     * @function #gpioget
     * @description Private method to get GPIO value
     * @return {Promise} value (0,1) or -1
     */
    async get() {
        if (RIO.cbmUsed.indexOf(this.bcm) === -1) {
            this.bcm = -1
            log("gpio", this.bcm, "is not enabled")
            return "pin " + this.bcm + " for input operations"
        }

        const result = await ioGet(this.bcm)
        if (result.msg === "ok") {
            log("gpio", this.bcm, "get value:", result.data)
            return result.data
        } else {
            log("gpio", this.bcm, "get error:", result.data)
            return -1
        }
    }
}

// -------------------------------------------------------------------
// TEST
/** ------------------------------------------------------------------
 * @function ioTest
 * @description Test command(s)
 */
export const rioTest = async (mode = "mon") => {
    if (mode === "out") {
        const led = new RpiOut(17)
        await led.set()
        await sleep(3000)
        await led.reset()
    }
    if (mode === "in") {
        const btn = new RpiIn(18)
        await btn.get()
    }
    if (mode === "mon") {

        class GpioMonitor {
            constructor(chip = "gpiochip0", lineOffset = "18") {
                this.chip = chip;
                this.lineOffset = lineOffset;
                this.proc = null;
            }

            start() {
                if (this.proc) return log("already running");

                this.proc = spawn("gpiomon", ["-r", "-b", "--format=%o %e %s %n", this.chip, this.lineOffset]);

                this.proc.stdout.on("data", (data) => {
                    const parts = data.toString().trim().split(/\s+/);
                    if (parts.length >= 4) {
                        const [offset, edge, sec, nsec] = parts;
                        log(`Offset ${offset}: edge=${edge === "1" ? "rising" : "falling"} at ${sec}s ${nsec}ns`);
                    } else {
                        log("Output incompris :", parts);
                    }
                });

                this.proc.stderr.on("data", (data) => console.error(`gpiomon stderr: ${data}`));

                this.proc.on("close", (code, signal) => {
                    console.log(`gpiomon terminé (code=${code}, signal=${signal})`);
                    this.proc = null;
                });

                process.on("SIGINT", () => {
                    console.log("Arrêt par Ctrl+C");
                    this.stop();
                    process.exit(0);
                });
            }

            stop() {
                if (this.proc) this.proc.kill("SIGTERM");
                this.proc = null;
            }
        }

        const mymon = new GpioMonitor()
        mymon.start()
    }
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------