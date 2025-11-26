// -------------------------------------------------------------------
// TEST - PWM for led
// -------------------------------------------------------------------
import {RIO, traceCfg, log, sleep, ctrlC, lineNumber} from "../esm/main.mjs"

(async () => {
    traceCfg(2)
    const line = lineNumber(2)
    if (line < 0) return

    // Init pwm line and set duty = 0%
    const led = new RIO(line, "pwm", {
        exportTime: 50,// delay for export on init
        period: 1000,  // 1,000,000 ns ~ 1 KHz
        dutyMin: 0,
        dutyMax: 1000
    })
    log("led:", led)
    ctrlC(() => {
        led.close()
    })

    for (let i = 1; i < 101; i++) {
        led.pwmDuty(i)
        await sleep(30, false)
    }
    await sleep(2000)
    led.pwmDuty(0)
    led.close()
    log("led closed")
})()


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------