// -------------------------------------------------------------------
// TEST - Simple read
// -------------------------------------------------------------------
import {RIO, traceCfg, log, sleep, ctrlC, lineNumber} from "../esm/main.mjs"

(async () => {
    traceCfg(2)
    const line = lineNumber(2)
    if (line < 0) return

    // Init input line
    const btn = new RIO(line, "input", {bias: "pull-down"})
    log("button:", btn)
    ctrlC(() => {
        btn.close()
    })

    log("button value:", btn.read())
    log("input monitoring active for 10s")
    const callback = edge => {
        log("edge:", edge)
    }
    btn.monitoringStart(callback, "both", 30)
    await sleep(10000)
    btn.close()
})()

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------