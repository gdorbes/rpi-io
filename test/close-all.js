// -------------------------------------------------------------------
// TEST - closeAll
// -------------------------------------------------------------------
import {RIO, traceCfg, log, sleep, ctrlC, lineNumber} from "../esm/main.mjs"

(async () => {
    traceCfg(2)

    const line1 = lineNumber(2)
    if (line1 < 0) return

    const line2 = lineNumber(3)
    if (line2 < 0) return

    const led = new RIO(line1, "output", {value: 0})
    const btn = new RIO(line2, "input")
    log("led:", led)
    log("btn:", btn)

    await sleep(1000)
    RIO.closeAll()
})()


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------