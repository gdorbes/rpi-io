// -------------------------------------------------------------------
// TEST CUSTOM CONSOLE
// -------------------------------------------------------------------
import {traceCfg, log, warn} from "../esm/log.mjs"

// Default behavior: No console
log("nothing")
warn("nothing")

// Full console
traceCfg(2)
log("console display")
warn("warning display")

// Warning only
traceCfg(1)
log("not displayed")
warn("warning display again")

// Back to no console
traceCfg(0)
log("nothing again")
warn("nothing again")

// Full console
traceCfg(2)
log("console display again")
warn("warning display again")

// Warning only
traceCfg(1)
log("not displayed")
warn("warning display again again")

// Back to no console
traceCfg(0)
log("nothing again")
warn("nothing again")
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------