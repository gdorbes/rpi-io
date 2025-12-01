// -------------------------------------------------------------------
// RPI-IO: Custom console.log
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

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------