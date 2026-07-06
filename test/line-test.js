// -------------------------------------------------------------------
// TEST - line support and availability
// -------------------------------------------------------------------
import {RIO, traceCfg, log} from "../esm/main.mjs"

traceCfg(2)
log("line  1 is supported:", RIO.lineIsSupported(1))
log("line 17 is supported:", RIO.lineIsSupported(17))
log("line 17 is available:", RIO.lineIsAvailable(17))
const led = new RIO(17, "output", {value: 0})
log("new instance with line 17")
log("line 17 is available:", RIO.lineIsAvailable(17))
RIO.closeAll()
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------