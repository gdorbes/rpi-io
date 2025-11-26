// -------------------------------------------------------------------
// TEST - PWM for servo-motor SG90
// Info: https://wiki.openelab.io/motors/servo-motor-sg90
// -------------------------------------------------------------------
import {RIO, traceCfg, log, sleep, ctrlC, lineNumber} from "../esm/main.mjs"

(async () => {
    traceCfg(2)
    const line = lineNumber(2)
    if (line < 0) return

    // Init pwm line and set duty = 0%
    const servo = new RIO(line, "pwm", {
        exportTime: 100,// delay for export on init
        period: 20000,  // 20,000,000 ns ~ 50 Hz
        dutyMin: 500,   //    500,000 ns ~ 0.5 ms
        dutyMax: 2500   //  2,500,000 ns ~ 2.5 ms
    })
    ctrlC(() => {
        servo.close()
    })
    log("servo initialized --> duty = 0%")
    await sleep(2000)
    servo.pwmDuty(50)
    log("servo duty = 50%")     // ~ 0.5 + (0.5 * (2.5 ms - 0.5 ms)) = 1.5 ms
    await sleep(2000)
    servo.pwmDuty(100)
    log("servo duty = 100%")    // ~ 0.5 + (1.0 * (2.5 ms - 0.5 ms)) = 2.5 ms
    await sleep(2000)
    servo.pwmDuty(0)
    log("servo duty = 0%")      // ~ 0.5 + (0.0 * (2.5 ms - 0.5 ms)) = 0.5 ms
    await sleep(2000)
    servo.close()
    log("servo closed")
})()


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------