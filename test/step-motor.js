// -------------------------------------------------------------------
// RPI-IO: STEP MOTOR TEST SCRIPT ⚠️ Work in Progress
// -------------------------------------------------------------------
import {RIO} from "../esm/main.mjs";
import {STEP, tlog} from "../esm/step.mjs"

// Close any open rpi-io instance to prevent error
RIO.closeAll()

// Open step controller in half step mode => Half turn forward and backward => Close
const motor28BYJH = new STEP("uln2003", {
    coilA: new RIO(21, "output"),
    coilB: new RIO(22, "output"),
    coilC: new RIO(24, "output"),
    coilD: new RIO(25, "output")
}, {
    delay: 0,
    sequence: "half"
})
tlog("motor28BYJH creation status:", motor28BYJH.status)
await motor28BYJH.rotate(2048, "forward", false)
await motor28BYJH.rotate(2048, "backward", false)
motor28BYJH.close()

// Open step controller in full step mode => Half turn forward and backward => Close
const motor28BYJF = new STEP("uln2003", {
    coilA: new RIO(21, "output"),
    coilB: new RIO(22, "output"),
    coilC: new RIO(24, "output"),
    coilD: new RIO(25, "output")
}, {
    delay: 4,
    sequence: "full"
})
tlog("motor28BYJF creation status:", motor28BYJF.status)
await motor28BYJF.rotate(1024, "forward", false)
await motor28BYJF.rotate(1024, "backward", false)
motor28BYJF.close()

// A4988 drivers require one line per parameter as in the example below
const a4988 = {
    pulse: new RIO(5, "output"),
    direction: new RIO(6, "output"),
    enable: new RIO(26, "output")
}

// DM452 drivers require one line per parameter as in the example below
const dm452 = {
    pulse: new RIO(16, "output"),
    direction: new RIO(17, "output"),
    polarity: new RIO(27, "output")
}

// When done close all rpi-io instances
RIO.closeAll()

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------