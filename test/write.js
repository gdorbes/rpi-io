// -------------------------------------------------------------------
// TEST - Simple write
// -------------------------------------------------------------------
import {RIO, traceCfg, log, sleep, ctrlC, lineNumber} from "../esm/main.mjs"

(async () => {
    traceCfg(2)

    const line = lineNumber(2)
    if (line < 0) return

    // Init output line and ctrl+c to close it
    const led = new RIO(line, "output", {value: 0})
    log("led:", led)
    ctrlC(() => {
        led.close()
    })

    // Turn led on for 3s
    led.write(1)
    log("led turn on")
    await sleep(3000)
    led.write(0)
    log("led turn off")
    led.close()
})()
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------