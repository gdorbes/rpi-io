// -------------------------------------------------------------------
// TEST - Line configuration
// -------------------------------------------------------------------
import {traceCfg, log, lineNumber, lineConfig} from "../esm/main.mjs"

(async () => {
    traceCfg(2)
    const line = lineNumber(2)
    if (line < 0) return
    log("line", line, "-->", lineConfig(line))
})()


// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------