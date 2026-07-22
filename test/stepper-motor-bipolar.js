// -------------------------------------------------------------------
// RPI-IO: BIPOLAR STEPPER MOTOR TEST - DM542 HARDWARE DRIVER
// -------------------------------------------------------------------
import {StepperBipolar, RIO, traceCfg, log, warn, sleep, ctrlC} from "../extensions/stepper-bipolar.mjs"

traceCfg(2)

ctrlC(() => {
    RIO.closeAll()
})

// Open output lines GPIO21 and GPIO22
const pul = new RIO(21, "output", {value: 0})
const dir = new RIO(22, "output", {value: 0})

// Create Bipolar Stepper Motor instance
const bipolar = new StepperBipolar(pul, dir, "desc", 10)

// Start rotating full turn (depending on hardware driver settings)
bipolar.rotate(25600, "forward").then(stepped => {
    log("stepped:", stepped)
    // Reset and close lines
    pul.write(0)
    dir.write(0)
    pul.close()
    dir.close()
})

// Stop rotation after 200ms
await sleep(200)
log("stop rotation")
bipolar.stop()

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------