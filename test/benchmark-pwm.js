// -------------------------------------------------------------------
// TEST - Benchmark pwm duty update x1,000,000
// -------------------------------------------------------------------
import {RIO, traceCfg, log, lineNumber, ctrlC} from "../esm/main.mjs"
(async () => {
    traceCfg(2)
    const line = lineNumber(2)
    if (line < 0) return

    // Init pwm line and set duty = 0%
    const led = new RIO(line, "pwm", {
        period: 1000,  // 1,000,000 ns ~ 1 KHz
        dutyMin: 0,
        dutyMax: 1000
    })

    ctrlC(() => {
        led.close()
    })

    // pwm update loop x1,000,000
    let len = 1000000
    log("Benchmark pwm update x1,000,000")
    const start = new Date()
    while (len--) {
        led.pwmDuty(50)
    }
    const stop = new Date()
    log("Elapse time:", stop - start, "ms")
    led.close()
})()










// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------