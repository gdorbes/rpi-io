// -------------------------------------------------------------------
// RPI-IO: UNIPOLAR STEPPER MOTOR TEST
// -------------------------------------------------------------------
import {StepperUnipolar, RIO, traceCfg, log, warn, sleep} from "../extensions/stepper-unipolar.mjs"

traceCfg(2)

// Open step controller in half step mode => Half turn forward and backward => Close
const motor28BYJH = new StepperUnipolar(new RIO(21, "output"), new RIO(22, "output"), new RIO(24, "output"), new RIO(25, "output"), "half", 0)
log("motor28BYJH creation status:", motor28BYJH.status)
await motor28BYJH.rotate(2048, "forward", false)
await motor28BYJH.rotate(2048, "backward", false)
motor28BYJH.close()

// Open step controller in full step mode => Half turn forward and backward => Close
const motor28BYJF = new StepperUnipolar(new RIO(21, "output"), new RIO(22, "output"), new RIO(24, "output"), new RIO(25, "output"), "full", 4)
log("motor28BYJF creation status:", motor28BYJF.status)
await motor28BYJF.rotate(1024, "forward", false)
await motor28BYJF.rotate(1024, "backward", false)
motor28BYJF.close()

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------