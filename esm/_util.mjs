// -------------------------------------------------------------------
// RPI-IO: Nodejs tools and utilities
// -------------------------------------------------------------------
import {execSync} from "child_process"
import {spawnSync} from "node:child_process"

// -------------------------------------------------------------------
// DEV UTILITIES
// -------------------------------------------------------------------
let debug = {
    trace: false,
    warn: true
}
/** ------------------------------------------------------------------
 * @function traceCfg
 * @description Set log configuration
 * @param {Number} level    0: no log, 1: warn only, 2: warn and log
 */
export const traceCfg = level => {
    debug = {
        trace: false,
        warn: false
    }
    level > 1 ? debug.trace = true : false
    level > 0 ? debug.warn = true : false
}

/** ------------------------------------------------------------------
 * @function nowStr
 * @description Return timestamp as formatted string
 * @return {String}
 */
const nowStr = () => {
    const date = new Date()
    return date.toLocaleTimeString() + "." + date.getMilliseconds().toLocaleString('en', {
        minimumIntegerDigits: 3,
        minimumFractionDigits: 0,
        useGrouping: false
    })
}

/** ------------------------------------------------------------------
 * @function log
 * @description Global customized timestamped console.log
 *              Requires global variable 'debug'
 */
export const log = function () {
    if (debug.trace)
        console.log.apply(console, Array.prototype.concat.apply([nowStr(), "🔎 "], arguments))
}

/** ------------------------------------------------------------------
 * @function warn
 * @description Colored log for error messages ⚠️ nodejs only ~ CSS color #F50
 */
export const warn = function () {
    if (debug.warn)
        console.log.apply(console, Array.prototype.concat.apply([nowStr(), "⚠️", "\x1b[38;2;255;80;0m", ...arguments, "\x1b[0m"]))
}

/** ------------------------------------------------------------------
 * @function sleep
 * @description Wait before continuing
 * @param {Number} ms
 * @param {Boolean} track
 */
export const sleep = (ms, track = true) => {
    track ? log("sleeping", ms, "ms") : false
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** ------------------------------------------------------------------
 * @function wait
 * @description Wait before continuing (sync blocking mode)
 * @param {Number} ms
 */
export const wait = ms => {
    log("waiting", ms, "ms")
    spawnSync("sleep", [ms / 1000])
}

/** ------------------------------------------------------------------
 * @function ctrlC
 * @description Intercept ctrl+c then exec callback
 * @param {Function} callback
 */
export const ctrlC = callback => {
    process.on("SIGINT", () => {
        log("ctrl+c pressed")
        typeof callback === "function" ? callback() : false
        process.exit(0)
    })
}

/** ------------------------------------------------------------------
 * @function lineConfig
 * @description Return line configuration
 * @param {Number} line
 * @return {String}
 */
export const lineConfig = line => {
    const stdout = execSync("pinctrl get " + line, {stdio: "pipe", encoding: "utf8"}).trim().split(/\s+/)
    return stdout[stdout.length - 1].toLowerCase()
}

/** ------------------------------------------------------------------
 * @function lineNumber
 * @param {Number} nth
 * @return {Number}
 */
export const lineNumber = nth => {
    const arg = parseInt(process.argv[nth])
    if (typeof arg !== "number" || arg !== arg) {
        warn("Line number expected as argument")
        return -1
    }
    return arg
}

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------