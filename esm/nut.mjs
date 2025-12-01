// -------------------------------------------------------------------
// RPI-IO: Nodejs utilities
// -------------------------------------------------------------------
import {execSync, spawnSync} from "node:child_process"
import {log} from "./log.mjs"
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
 * @function lineConfig
 * @description Return line configuration
 * @param {Number} line
 * @return {String}
 */
export const lineConfig = line => {
    const stdout = execSync("pinctrl get " + line, {stdio: "pipe", encoding: "utf8"}).trim().split(/\s+/)
    return stdout[stdout.length - 1].toLowerCase()
}


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------