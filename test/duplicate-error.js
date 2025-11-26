// -------------------------------------------------------------------
// TEST - Duplicate instance
// -------------------------------------------------------------------
import {RIO, traceCfg, log, sleep, ctrlC, lineNumber} from "../esm/main.mjs"

(async () => {
    traceCfg(2)

    const line = lineNumber(2)
    if (line < 0) return


    let led = new RIO(line, "output", {value: 0})
    led.close()

    // It works
    led = new RIO(line, "output", {value: 0})
    log("lead again:", led)

    // It doesn't work!
    log("now an error 🤓")
    const ooops = new RIO(line, "output", {value: 0})

})()


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------