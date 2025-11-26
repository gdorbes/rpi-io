// -------------------------------------------------------------------
// TEST - Benchmark read x1,000,000
// -------------------------------------------------------------------
import {RIO, traceCfg, log, lineNumber} from "../esm/main.mjs"
(async () => {
    traceCfg(2)
    const line = lineNumber(2)
    if (line < 0) return

    // Init input line
    const btn = new RIO(line, "input", {bias: "pull-down"})
    log("button:", btn)

    // read loop x1,000,000
    let len = 1000000
    log("Benchmark read x1,000,000")
    const start = new Date()
    while (len--) {
        btn.read()
    }
    const stop = new Date()
    btn.close();
    log("Elapse time:", stop - start, "ms")
})()










// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------