// -------------------------------------------------------------------
// JS GPIO API: IN, OUT, PWM
// Source: https://libgpiod.readthedocs.io/en/stable/gpio_tools.html
// Details: man gpiodetect
// -------------------------------------------------------------------
import {spawn} from "child_process";
import {writeFileSync, readFileSync} from "fs"
import {exeFile, exeShell, wait} from "./utl.mjs"
import {logCfg, log, trap} from "./dev.mjs"

// -------------------------------------------------------------------
// CLASS RIO AND FURTHER
/** ------------------------------------------------------------------
 * @class RIO
 * @classDesc Raspberry IO
 * @param {Number} gpio
 */
export class Rio {

    // ---------------------------------------------------------------
    // CONSTANTS AND VARIABLES AND FUNCTIONS
    // ---------------------------------------------------------------
    // Tested system environments: model, os, libgpiod
    static TESTED_MODELS = ["Raspberry Pi 5 Model B Rev 1.0"]
    static TESTED_OS = ["Bookworm", "Trixie"]
    static TESTED_LIBGPIOD = ["v1.6.3", "v2.2.1"]

    // Lists of supported GPIOs. Reference GPIO: pinout.xyz
    static RPi_GPIO_CORE = [4, 5, 6, 16, 17, 20, 21, 22, 23, 24, 25, 26, 27]
    static RPi_GPIO_PWM = [12, 13, 18, 19]
    static RPI_GPIOS = [...Rio.RPi_GPIO_CORE, ...Rio.RPi_GPIO_PWM]
    static RPI_CHIP = "gpiochip0"
    static PWM_CHIP = "pwmchip0"
    static TYPES = ["in", "out", "pwm"]

    // Map of instances
    static instances = new Map()

    // ---------------------------------------------------------------
    // GENERIC METHODS: constructor, disable
    /** --------------------------------------------------------------
     * @function constructor
     * @description
     * @param {Number} gpio
     * @param {String} type - {'in', 'out', 'pwm'}
     * @return {Object}
     */
    constructor(gpio, type) {

        this.gpio = gpio
        this.gpioStr = this.gpio.toString()
        this.gpioName = "GPIO" + this.gpioStr
        this.type = type
        this.os = Rio.os().name
        this.versionLib = Rio.version().substring(0, 4)
        // Monitoring properties
        this.watch = {
            edge: "stop",
            callback: false,
            process: null
        }

        // OS is not supported
        if (Rio.TESTED_OS.indexOf(this.os) === -1)
            throw new Error("This OS is not supported: " + this.os)

        // libgpiod is not supported
        const foundLib = Rio.TESTED_LIBGPIOD.find(testedVersion => {
            return this.versionLib === testedVersion.substring(0, 4)
        })
        if (!foundLib)
            throw new Error("This version of libgpiod is not supported: " + this.versionLib)

        // Unknown type
        if (Rio.TYPES.indexOf(type) === -1)
            throw new Error("This type is not supported: " + gpio)

        // gpio is not supported
        if (Rio.RPI_GPIOS.indexOf(gpio) === -1)
            throw new Error("This gpio is not supported: " + gpio)

        // gpio is already defined
        if (Rio.instances.has(gpio))
            throw new Error("This gpio is already defined: " + gpio)

        // this.read, this.write, monArgs depending on gpiolib version
        switch (this.versionLib) {
            case "v1.6":
                this.write = (value) => {
                    exeFile("gpioset", [Rio.RPI_CHIP, this.gpioStr + "=" + value])
                }
                this.read = () => {
                    return exeFile("gpioget", [Rio.RPI_CHIP, this.gpioStr])
                }
                break
            case "v2.2":
                this.write = (value, time = 0) => {
                    exeFile("gpioset", ["-t" + time, this.gpioName + "=" + value])
                }
                this.read = () => {
                    return exeFile("gpioget", ["--numeric", this.gpioName])
                }
                break
        }

        // pwm specific cases
        if (type === "pwm") {

            // gpio is not supported for PWM
            if (Rio.RPi_GPIO_PWM.indexOf(gpio) === -1) {
                throw new Error("PWM gpio must be one of " + Rio.RPi_GPIO_PWM)
            }

            // gpio is not setup for PWM
            const thisConfig = Rio.config(gpio)
            if (thisConfig.indexOf("pwm") === -1)
                throw new Error("This gpio is not setup as PWM (see README)")

            this.channel = thisConfig.slice(-1)
            this.pwm = Rio.PWM_CHIP
            this.pathPwm = "/sys/class/pwm/" + this.pwm + "/"
            this.pathChannel = this.pathPwm + "pwm" + this.channel + "/"
        }
        // Everything OK => Add this to instance list
        Rio.instances.set(gpio, this)
        log("new gpio instance created:", this.gpio)
    }

    /** --------------------------------------------------------------
     * @function disable
     * @description Remove instance from Rio.instances
     *              Set this.gpio = -1
     */
    disable() {
        if (Rio.instances.has(this.gpio)) {
            this.gpio = -1
            this.watch.edge = "stop"
            this.watch.callback = false
            this.watch.process !== null ? this.watch.process.kill("SIGTERM") : false
            Rio.instances.delete(this.gpio)
            log("gpio", this.gpio, "has been disabled")
        } else {
            log("gpio", this.gpio, "is already disabled")
        }
    }

    // ---------------------------------------------------------------
    // OUTPUT METHODS: set
    /** --------------------------------------------------------------
     * @function set
     * @description Set gpio to 1 or 0
     *              Then invert when duration time is <> 0
     * @param {Number} value
     * @param {Number} duration ms
     */
    set(value = 0, duration = 0) {

        if (this.gpio === -1)
            throw new Error("This instance is disabled")

        if (this.type !== "out")
            throw new Error("Set is dedicated to 'out' instances")

        if ([0, 1].indexOf(value) === -1)
            throw new Error("Value must be either 0 or 1")

        if (duration === 0) {
            this.write(value)
            log("set gpio", this.gpio, "to", value)
        }
        // Optional timer
        else {
            this.write(value)
            log("set gpio", this.gpio, "to", value)
            setTimeout(() => {
                const valueStop = Math.abs(value - 1)
                this.write(valueStop)
                log("set gpio", this.gpio, "to", valueStop)
            }, duration)
        }
    }

    // ---------------------------------------------------------------
    // INPUT METHODS
    /** --------------------------------------------------------------
     * @function get
     * @description Get gpio value (0/1)
     */
    get() {
        if (this.gpio === -1)
            throw new Error("This instance is disabled")

        if (this.type !== "in")
            throw new Error("Get is dedicated to 'in' instances")

        const str = this.read()

        let result
        str.length === 0 ? result = -1 : result = parseInt(str.replace(/\r?\n|\r/, ""))
        log("get gpio", this.gpio, "value:", result)
        return result
    }

    /** --------------------------------------------------------------
     * @function monArgs
     * @description Utility to take care gpiomon arguments according to libgpiod version
     * @param {Array} gpios
     * @param {Object} opt
     * @return {Array}
     */
    #monArgs = (gpios, opt) => {
        let args = []
        switch (this.versionLib) {
            case "v1.6":
                args.push("-b") // line-buffered: output is flushed after every line
                args.push("--bias=" + opt.bias)
                args.push("--format=%o %e") // gpio, edge. Others: seconds(%s) and nanoseconds (%n)
                args.push(Rio.RPI_CHIP)
                return args.concat(gpios)
            case "v2.2":
                opt.bias === "disable" ? opt.bias = "disabled" : false
                gpios = gpios.map(gpio => "GPIO" + gpio)
                args.push("--bias")
                args.push(opt.bias)
                return args.concat(gpios)
        }
    }

    /** --------------------------------------------------------------
     * @function monData
     * @description Utility to take care of gpiomon stdout data
     * @param {String} data
     * @return {Object}
     */
    #monData = data => {
        switch (this.versionLib) {
            case "v1.6":
                const [gpioV1, edgeV1] = data.toString().trim().split(/\s+/)
                return {
                    gpio: gpioV1,
                    edge: edgeV1
                }
            case "v2.2":
                const [timeV2, edgeV2, gpioV2] = data.toString().trim().split(/\s+/)
                return {
                    time: timeV2,
                    gpio: gpioV2.substring(5, 7),
                    edge: edgeV2
                }
        }
    }
    /** --------------------------------------------------------------
     * @function monCallback
     * @description Utility to trigger callback from gpiomon stdout data
     * @param {String} data
     */
    #monCallback = data => {
        const eventData = this.#monData(data)
        const now = new Date()
        const delta = Math.max(1, now - this.monitoredEvent.latest) // delta is always > 0ms
        const edge = eventData.edge === "1" ? "rising" : "falling"

        // Bounce detected
        if (delta <= this.bounceTime && edge === this.monitoredEvent.edge) {
            log("bounce detected on gpio", this.gpio, edge, delta + "ms")
        }
        // Trigger callback according to edge requirement
        else {
            if (this.watch.enabled.indexOf(edge) !== -1)
                this.watch.callback(edge, now)
            // log("monitored event on gpio", this.gpio, edge,)
        }

        // Update latest monitored event
        this.monitoredEvent.latest = now
        this.monitoredEvent.edge = edge
    }

    /** --------------------------------------------------------------
     * @function monitor
     * @description Wait for edge events
     * @param {String} edge {'stop', 'rising', 'falling' 'both'}
     * @param {Function} callback (edge, time)
     * @param {Object} opt  - opt.bias {'disable','pull-up','pull-down'}
     *                      - opt.bounce 0-1000
     */
    monitor(edge, callback, opt) {

        // Default and clean parameters
        const defaultCallback = (edge, time) => {
            log("gpio", this.gpio, "event:", edge, time)
        }
        const defopt = {
            bias: "disable",
            bounce: 0
        }

        callback === undefined ? callback = defaultCallback : false
        opt = {...defopt, ...opt}
        opt.bounce < 0 ? opt.bounce = 0 : false
        opt.bounce > 1000 ? opt.bounce = 1000 : false
        this.bounceTime = opt.bounce
        this.monitoredEvent = {
            latest: new Date(null),
            edge: "none"
        }

        const biases = ["disable", "pull-up", "pull-down"]
        biases.indexOf(opt.bias) === -1 ? opt.bias = "disable" : false

        if (this.gpio === -1)
            throw new Error("This instance is disabled")

        if (this.type !== "in")
            throw new Error("Monitor is dedicated to 'in' instances")

        if (["stop", "rising", "falling", "both"].indexOf(edge) === -1)
            throw new Error("Edge " + edge + "is not supported")

        if (typeof callback !== "function")
            throw new Error("Callback is not a function")

        // First time the instance is monitored or has been stopped
        if (this.watch === "stop") {

            if (edge === "stop") {
                trap("cannot stop an unstarted monitoring on gpio", this.gpio)
            }
            // Edge is in ["rising", "falling", "both"]
            else {
                this.watch = {
                    edge: edge,
                    enabled: edge === "both" ? ["rising", "falling"] : [edge],
                    callback: callback,
                    process: spawn("gpiomon", this.#monArgs([this.gpio], opt))
                }
                this.watch.process.stdout.on("data", this.#monCallback)
            }
        }
        // Instance is already monitored
        else {
            // Stop: Kill process and delete monitored data
            if (edge === "stop") {
                this.watch.process !== null ? this.watch.process.kill("SIGTERM") : false
                this.watch.edge = "stop"
                this.watch.enabled = []
                this.watch.callback = false
                this.watch.process = null
                Rio.instances.set(this.gpio, this)
                log("monitoring of gpio", this.gpio, "has been stopped")
            }

            // Kill process, update edge and callback, define new process
            else {
                this.watch.process !== null ? this.watch.process.kill("SIGTERM") : false
                this.watch.edge = edge
                this.watch.enabled = edge === "both" ? ["rising", "falling"] : [edge]
                this.watch.callback = callback
                this.watch.process = spawn("gpiomon", this.#monArgs([this.gpio], opt))
                this.watch.process.stdout.on("data", this.#monCallback)
            }
        }
    }

    // ---------------------------------------------------------------
    // PWM METHODS
    // PLEASE NOTE - Commands to unlock a channel:
    //        pwm channel 0: echo 0 > /sys/class/pwm/pwmchip0/unexport
    //        pwm channel 0: echo 1 > /sys/class/pwm/pwmchip0/unexport
    /** --------------------------------------------------------------
     * @function pwmInit
     * @description Start PWM modulation
     * @param {Number} period in ns
     * @param {Number} duty cycle in ns
     * @param {Object} opt
     */
    pwmInit(period = 20000000, duty = 0, opt) {

        // Stop on wrong type
        if (this.type !== "pwm")
            throw new Error("This GPIO is not configured as PWM")

        // Stop disabled device
        if (this.gpio === -1)
            throw new Error("This instance is disabled")

        // Set default options
        const defopt = {
            dutyMin: 0,
            dutyMax: 1000000000, // 1s
        }
        opt = {...defopt, ...opt}

        this.period = period
        this.duty = duty
        this.dutyMin = Math.max(0, opt.dutyMin)
        this.dutyMax = Math.min(period, opt.dutyMax)

        // Check period
        if (this.period < 100 || this.period > 1000000000)
            throw new Error("PWM period is out of range (100ns - 1s")

        // Check duty cycle
        if (duty < this.dutyMin)
            throw new Error("PWM duty " + duty + " is lower than duty min " + this.dutyMin)
        if (duty > this.dutyMax)
            throw new Error("PWM duty" + duty + " is upper than duty max" + this.dutyMax)

        log("channel", this.channel, "normalized PWM data (period, duty, duty min, duty max):", this.period, this.duty, this.dutyMin, this.dutyMax)

        // Export channel, then set period, duty cycle and enable
        writeFileSync(this.pathPwm + "export", this.channel)
        this.exported = true

        try {
            wait(100)
            writeFileSync(this.pathChannel + "period", String(this.period))
            writeFileSync(this.pathChannel + "duty_cycle", String(this.duty))
            writeFileSync(this.pathChannel + "enable", "1")
            this.enabled = true

        } catch (err) {
            trap("pwm start error:", err)
            this.pwmStop()
        }
    }

    /** --------------------------------------------------------------
     * @function pwmStop
     * @description Stop PWM modulation
     */
    pwmStop() {

        if (this.type !== "pwm")
            throw new Error("This GPIO is not configured as PWM")

        // Disable signal then unexport channel
        writeFileSync(this.pathChannel + "enable", "0")
        this.enabled = false
        writeFileSync(this.pathPwm + "unexport", this.channel)
        this.exported = true
    }

    /** --------------------------------------------------------------
     * @function pwmDuty
     * @description Change PWM duty cycle
     * @parameter {Number} time
     */
    pwmDuty(time) {

        // Not PWM
        if (this.type !== "pwm")
            throw new Error("This GPIO is not configured as PWM")

        // Not initialized
        if (!this.enabled || !this.exported) {
            trap("PWM duty cycle cannot be update if port is not exported and enabled")
            return
        }

        // Out of range
        this.duty = time
        if (typeof this.duty !== "number" || this.duty < this.dutyMin) {
            this.duty = this.dutyMin
            trap("duty cycle forced to", this.dutyMin)
        }
        if (typeof this.duty !== "number" || this.duty > this.dutyMax) {
            this.duty = this.dutyMax
            trap("duty cycle forced to", this.dutyMax)
        }

        writeFileSync(this.pathChannel + "duty_cycle", this.duty.toString())
    }
}

// -------------------------------------------------------------------
// STATIC METHODS
/** ------------------------------------------------------------------
 * @function Rio.config
 * @description Return GPIO configuration
 * @param {Number} gpio
 * @return {String}
 */
Rio.config = gpio => {
    const a = exeShell("pinctrl get " + gpio).trim().split(/\s+/)
    return a[a.length - 1].toLowerCase()
}
/** ------------------------------------------------------------------
 * @function Rio.configs
 * @description Return GPIO configuration for all supported GPIO
 * @return {Object}
 */
Rio.configs = () => {
    let configs = {}
    Rio.RPI_GPIOS.forEach(gpio => {
        configs[gpio] = Rio.config(gpio)
    })
    log("gpio configs:", configs)
    return configs
}

/** ------------------------------------------------------------------
 * @function Rio.info
 * @description Exec gpioinfo
 * @return {Object}
 */
Rio.info = () => {
    return exeFile("gpioinfo", [Rio.RPI_CHIP])
}

/** ------------------------------------------------------------------
 * @function Rio.detect
 * @description Exec gpiodetect
 * @return {Object}
 */
Rio.detect = () => {
    return exeFile("gpiodetect")
}

/** ------------------------------------------------------------------
 * @function Rio.version
 * @description Return libgpiod version
 * @return {Object}
 */
Rio.version = () => {
    return exeFile("gpiodetect", ["-v"]).split("\n").shift().substring(22).trim()
}

/** ------------------------------------------------------------------
 * @function Rio.stopMonitoring
 * @description Stop monitoring of all inputs
 */
Rio.stopMonitoring = () => {
    Rio.instances.forEach((that) => {
        if (that.watch.process !== null) {
            that.watch.process.kill("SIGTERM")
            that.watch.edge = "stop"
            that.watch.callback = false
            that.watch.process = null
            log("monitoring of gpio", that.gpio, "has been stopped")
        }
    })
}

/** ------------------------------------------------------------------
 * @function Rio.cpuInfo
 * @description Read '/proc/cpuinfo' and store it for further call
 * @return {String}
 */
Rio.cpuInfo = () => {
    if (typeof Rio.cpuInfo.value === "undefined") {
        try {
            Rio.cpuInfo.value = readFileSync("/proc/cpuinfo", "utf8")
        } catch (err) {
            trap("catched error opening '/proc/cpuinfo:", err)
            Rio.cpuInfo.value = ""
        }
    }
    return Rio.cpuInfo.value
}

/** ------------------------------------------------------------------
 * @function Rio.os
 * @description Return OS ID and name
 * @return {Object} {id: '12', name: 'Bookworm'}
 */
Rio.os = () => {
    const strOs = exeShell("cat /etc/os-release")
    if (strOs.length > 0) {
        const lines = strOs.split("\n")
        const info = {}
        lines.forEach(line => {
            const [key, value] = line.split("=")
            if (key && value) {
                info[key] = value.replace(/"/g, "");
            }
        })
        let res = {
            id: info["VERSION_ID"],
            name: info["VERSION_CODENAME"]
        }
        res.name = res.name.substring(0, 1).toUpperCase() + res.name.substring(1);
        return res
    }
}
/** ------------------------------------------------------------------
 * @function Rio.isSystemSupported
 * @description Check if all hardware and software requirements are
 *              satisfied to run the RPI-IO module
 * @return {Boolean}
 */
Rio.isSystemSupported = () => {

    // Test hardware
    if (/Raspberry Pi/i.test(Rio.cpuInfo()) === false) {
        trap("not a Raspberry Pi hardware")
        return false
    }
    log("👍  Hardware is Raspberry Pi")

    // Test model
    const line = Rio.cpuInfo().split("\n").find(str => str.indexOf("Model") !== -1)
    const model = line.split(":")[1].trim()
    if (Rio.TESTED_MODELS.indexOf(model) === -1) {
        trap("model not tested:", model)
        return false
    }
    log("👍 ", model, "is supported")

    // Test OS
    const thisOs = Rio.os()
    if (Rio.TESTED_OS.indexOf(thisOs.name) === -1) {
        trap("OS not tested:", thisOs.name, thisOs.id)
        return false
    }
    log("👍 ", thisOs.name, "OS is supported")

    // Test libgpiod version x.y
    const gpiodVersion = Rio.version().substring(0, 4)
    const foundLib = Rio.TESTED_LIBGPIOD.find(testedVersion => {
        return gpiodVersion === testedVersion.substring(0, 4)
    })
    if (!foundLib) {
        trap("libgpiod version not tested:", gpiodVersion)
        return false
    }
    log("👍  libgpiod version", gpiodVersion + ".x", "is supported")
    log("👍  Systems requirements for rpi-io are met")
    return true
}
/** ------------------------------------------------------------------
 * @function Rio.logCfg
 */
Rio.logCfg = logCfg

/** ------------------------------------------------------------------
 * @function Rio.log
 */
Rio.log = log

/** ------------------------------------------------------------------
 * @function Rio.trap
 */
Rio.trap = trap
// -------------------------------------------------------------------
// EoF
// -------------------------------------------------------------------