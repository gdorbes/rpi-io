// -------------------------------------------------------------------
// TEST - Benchmark write x1,000,000
// -------------------------------------------------------------------
import {RIO, traceCfg, log, lineNumber} from "../esm/main.mjs"
(async () => {
    traceCfg(2)
    const line = lineNumber(2)
    if (line < 0) return

    // Init output line and ctrl+c to close it
    const led = new RIO(line, "output", {value: 0})
    log("led:", led)

    // write loop x1,000,000
    let len = 500000
    log("Benchmark write x1,000,000")
    const start = new Date()
    while (len--) {
        led.write(1)
        led.write(0)
    }
    const stop = new Date()
    led.close();
    log("Elapse time:", stop - start, "ms")
})()










// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------