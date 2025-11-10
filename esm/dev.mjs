// -------------------------------------------------------------------
// RPi GPIO CONTROL - DEV TOOLS
// -------------------------------------------------------------------
let debug = {
    log: false,
    trap: true
}

// -------------------------------------------------------------------
// FUNCTIONS
/** ------------------------------------------------------------------
 * @function nowStr
 * @description Return timestamp as formatted string
 * @return {String}
 */
export const nowStr = () => {
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
    if (debug.log)
        console.log.apply(console, Array.prototype.concat.apply([nowStr(), "🔎 "], arguments))
}

/** ------------------------------------------------------------------
 * @function trap
 * @description Colored log for error messages ⚠️ nodejs only ~ CSS color #F50
 */
export const trap = function () {
    if (debug.trap)
        console.log.apply(console, Array.prototype.concat.apply([nowStr(), "⚠️", "\x1b[38;2;255;80;0m", ...arguments, "\x1b[0m"]))
}

/** ------------------------------------------------------------------
 * @function logCfg
 * @description Set log configuration
 * @param {Number} level    0: no log, 1: trap only, 2: trap and log
 */
export const logCfg = level => {
    debug = {
        log: false,
        trap: false
    }
    level > 1 ? debug.log = true : false
    level > 0 ? debug.trap = true : false
}
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------