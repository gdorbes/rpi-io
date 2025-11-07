// -------------------------------------------------------------------
// RPi GPIO CONTROL - UTILITIES
// -------------------------------------------------------------------
import {log, trap} from "./dev.mjs"
import {execSync, execFileSync, spawnSync} from "child_process"

// -------------------------------------------------------------------
// JS UTILITIES
/** ------------------------------------------------------------------
 * @function sleep
 * @description Wait before continuing
 * @param {Number} ms
 */
export const sleep = ms => {
    log("sleeping", ms, "ms")
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

// -------------------------------------------------------------------
// NODEJS UTILITIES
/** ------------------------------------------------------------------
 * @function exeShell
 * @description Async run command in Linux shell
 * @param {String} cmd
 * @return {String} stdout or ""
 */
export const exeShell = cmd => {
    try {
        return execSync(cmd, {
            stdio: "pipe",
            encoding: "utf8",
        })
    } catch (err) {
        if (err.code) {
            // Spawning child process failed
            trap("execFileSync error code", err.code)
        } else {
            // Child was spawned but exited with non-zero exit code
            // Error contains any stdout and stderr from the child
            const {stdout, stderr} = err
            trap({stdout, stderr})
        }
        return ""
    }
}

/** ------------------------------------------------------------------
 * @function exeFile
 * @description Async run executable file
 * @param {String} file
 * @param {Array} args
 * @return {String} stdout or ""
 */
export const exeFile = (file, args = []) => {
    try {
        return execFileSync(file, args, {
            stdio: "pipe",
            encoding: "utf8",
        })
    } catch (err) {
        if (err.code) {
            // Spawning child process failed
            trap("execFileSync error code", err.code)
        } else {
            // Child was spawned but exited with non-zero exit code
            // Error contains any stdout and stderr from the child
            const {stdout, stderr} = err
            trap({stdout, stderr})
        }
        return ""
    }
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


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------