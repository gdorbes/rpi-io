// -------------------------------------------------------------------
// TEST - Simple slow and fast pulse trains
// -------------------------------------------------------------------
import {RIO, traceCfg, log, sleep, ctrlC, lineNumber} from "../esm/main.mjs"

(async () => {
    traceCfg(2)

    // Read line number from command line
    const line = lineNumber(2)
    if (line < 0) return

    // Init output line and ctrl+c to close it
    const led = new RIO(line, "output", {value: 0})
    log("led:", led)
    ctrlC(() => {
        led.close()
    })

    // Slow pulse x10, ascending edge, w = 0.5 s, s = 0.5 s
    const pulseStatus = await led.pulseStart(10, "asc", {
        pulseWidth: 500000,
        spaceWidth: 500000
    })
    log("pulse status stopped when completed:", pulseStatus)

    // Fast pulse x1000, descending edge, w = 5µs, s = 5µs
    led.write(1) // Init line according to edge
    led.pulseStart(1000, "desc", {
        pulseWidth: 5,
        spaceWidth: 5
    }).then(pulseStatus => {
        log("pulse status stopped when stopped:", pulseStatus)
        led.write(0) // Reset line
        led.close()
    })
    await sleep(5)
    led.pulseStop() // Stop pulse train after 5ms

})()
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------