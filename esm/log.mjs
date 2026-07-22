// -------------------------------------------------------------------
// RPI-IO: Custom console.log
// -------------------------------------------------------------------
const noop = function () {
}
export let log = noop
export let warn = noop
/** ------------------------------------------------------------------
 * @function traceCfg
 * @description Set log configuration
 * @param {Number} level    0: no log, 1: warn only, 2: warn and log
 */
export const traceCfg = level => {

    const nowStr = () => {
        const date = new Date()
        return date.toLocaleTimeString() + "." + date.getMilliseconds().toLocaleString('en', {
            minimumIntegerDigits: 3,
            minimumFractionDigits: 0,
            useGrouping: false
        })
    }
    const timeStamped = function () {
        console.log.apply(console, Array.prototype.concat.apply([nowStr(), "🔎 "], arguments))
    }
    const timeColored = function () {
        console.log.apply(console, Array.prototype.concat.apply([nowStr(), "⚠️ ", "\x1b[38;2;255;80;0m", ...arguments, "\x1b[0m"]))
    }

    switch (level) {
        case 2:
            warn = timeColored
            log = timeStamped
            break
        case 1:
            warn = timeColored
            log = noop
            break
        default:
            warn = noop
            log = noop
    }
}


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------