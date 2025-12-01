// -------------------------------------------------------------------
// RPI-IO: Control utilities
// -------------------------------------------------------------------
import {log, warn} from "./log.mjs"

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
 * @function lineNumber
 * @description Return nth process argument and check it is a number
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