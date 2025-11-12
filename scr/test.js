// -------------------------------------------------------------------
// RPi GPIO CONTROL TEST SCRIPT
// -------------------------------------------------------------------
import {log, trap, nowStr} from "../esm/dev.mjs"
import {ctrlC} from "../esm/utl.mjs"
import {Rio} from "../esm/rio.mjs"

/** ------------------------------------------------------------------
 * @function info
 * @description Colored log for info messages  Node.js only ~ CSS color #F50
 * @param {String} cmd
 * @param {String} txt
 */
function info(cmd, txt) {
    console.log(nowStr(), "🔎", "\x1b[38;2;0;160;16m", cmd, "\x1b[0m", txt)
}

/** ------------------------------------------------------------------
 * @function isNumber
 * @description Test if param is number
 * @param {String} str
 * @return {Number}
 */
function isNumber(str) {
    const num = parseInt(str)
    if (typeof num !== "number" || num !== num) {
        trap("<gpio_number> is not a number or not defined")
        return -1
    } else {
        return num
    }
}

// -------------------------------------------------------------------
// TOP LEVEL TEST
// -------------------------------------------------------------------
(function () {
    Rio.logCfg(2)
    ctrlC(Rio.stopMonitoring)

    if (process.argv.length < 3) {
        trap("Arguments are missing! Type 'help' to display list of commands.")
        return
    }
    let gpio
    switch (process.argv[2]) {
        case "help":
            info("help", "To display this list.")
            info("detect", "To display gpio chipsets")
            info("lines", "To display gpiochip0 lines")
            info("version", "To display libgpiod version")
            info("system", "To test if your system (hw,sw, mw) meets the tested requirements.")
            info("config", "To display gpio system configuration.")
            info("out <gpio_number>", "To define a gpio as 'out' and set it to 1 for 5s.")
            info("in <gpio_number>", "To define a gpio as 'in' to display its value ")
            info("monitor <gpio_number>", "To define a gpio as 'in' to monitor events until ctrl+c.")
            info("pwm <gpio_number>", "Test SG90~like servo from 0° to 180° i.e. period=20ms, duty-cycle-range=0.5-2.5ms")
            info("benchmark <gpio_out> <gpio_in>", "Displays elapsed time of 1000 write + read operations")
            break
        case "version":
            log("libgpiod version:", Rio.version())
            break
        case "detect":
            log("chipsets:", Rio.detect())
            break
        case "lines":
            log("lines:", Rio.info())
            break
        case "system":
            Rio.isSystemSupported()
            break
        case "config":
            Rio.configs()
            break
        case "out":
            gpio = isNumber(process.argv[3])
            if (gpio > 0) {
                const led = new Rio(gpio, "out")
                led.set(1, 5000)
            }
            break
        case "in":
            gpio = isNumber(process.argv[3])
            if (gpio > 0) {
                const btn = new Rio(gpio, "in")
                btn.get()
            }
            break
        case "monitor":
            const gpio1 = isNumber(process.argv[3])
            const gpio2 = isNumber(process.argv[4])
            let btn1, btn2
            if (gpio1 > 0) {
                btn1 = new Rio(gpio1, "in")
                btn1.monitor("rising")
            }
            if (gpio2 > 0) {
                btn2 = new Rio(gpio2, "in")
                btn2.monitor("falling", () => {
                    log(gpio2, "falling")
                }, {bias: "pull-down"})
            }
            setTimeout(() => {
                btn1.monitor("stop")
            }, 6000)
            break
        case "benchmark":
            const gpioOut = isNumber(process.argv[3])
            const gpioIn = isNumber(process.argv[4])
            let len = 1000
            if (gpioOut > 0) {
                const led = new Rio(gpioOut, "out")
                const start1 = new Date()
                while (len--) {
                    led.write(1)
                }
                const stop1 = new Date()
                const time1 = Math.abs(stop1 - start1)
                log("Elapsed time for 1000 write ops:", time1, "ms")
            }
            len = 1000
            if (gpioIn > 0) {
                const btn = new Rio(gpioIn, "in")
                const start2 = new Date()
                while (len--) {
                    btn.read()
                }
                const stop2 = new Date()
                const time2 = Math.abs(stop2 - start2)
                log("Elapsed time for 1000 read  ops:", time2, "ms")
            }
            break
        case "pwm":
            const servo = new Rio(isNumber(process.argv[3]), "pwm")

            // 50hz, 0.5 ms
            servo.pwmInit(20000000, 500000, {
                dutyMin: 500000,
                dutyMax: 2500000
            })
            log("servo position 0°")

            // after 2s -> duty=1.5 ms
            setTimeout(() => {
                servo.pwmDuty(1500000)
                log("servo position = 90°")
            }, 2000)

            // after 4s -> duty=1.5 ms
            setTimeout(() => {
                servo.pwmDuty(2500000)
                log("servo position = 180°")
            }, 4000)

            // after 5s -> stop
            setTimeout(() => {
                servo.pwmStop()
                log("servo stopped")
            }, 5000)
            break
        case "disable":
            Rio.disableAll()
            break
        default:
            trap("Unknown command: Type 'test help' to display list of commands.")
    }
})()

// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------