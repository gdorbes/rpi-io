# Stepper Motor Extensions

Using the basic **rpi-io** methods for output  lines (*write*, *pulseStart*, *pulseStop*), it is easy to drive stepper motors, ranging from simple hobbyist motors (e.g., 28BYJ-48) to those designed for robotics and industrial applications, such as the NEMA series (e.g., NEMA 17, 23...) using some hardware driver (e.g. DMA542).

To facilitate this type of use, since version 3.1 **rpi-io** has included two stepper motor controller classes:

- The *StepperUnipolar* class is intended for stepper motors without a hardware driver.
- The *StepperBipolar* class is intended for stepper motors with a hardware driver such as the DM542.



## class StepperUnipolar

### Electronic wiring example

![](https://raw.githubusercontent.com/gdorbes/rpi-io/refs/heads/master/img/stepper-unipolar.png)

PLEASE NOTE:

- **GND is shared** — the Pi's GND and the ULN2003's GND must be tied together even if you power the motor from a separate supply, or the signals won't have a common reference.

- **Power source for VCC**: for light loads the Pi's 5V pin can drive the ULN2003/motor directly, but the 28BYJ-48 can draw enough current that it's safer to power VCC from a separate 5V supply, keeping only GND common with the Pi.

- The four GPIO pins (17, 18, 27, 22) are just a common convention — any four free GPIO pins work, as long as your code (e.g. via `RPi.GPIO` or `gpiozero`) references the pins you actually wired.

- The ULN2003 board's output side connects to the motor with its keyed 5-pin connector — it only fits one way, so no wiring decisions needed there.



### Example

See test [script](https://github.com/gdorbes/rpi-io/blob/master/test/stepper-motor-unipolar.js).

```js
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
```



### API

#### constructor StepperUnipolar(coilA, coilB, coilC, coilD, mode, delay)

**Parameter(s)**

- **coilA** *{Object}* **rpi-io** instance for Coil A

- **coilB** *{Object}* **rpi-io** instance for Coil B

- **coilC** *{Object}* **rpi-io** instance for Coil C

- **coilD** *{Object}* **rpi-io** instance for Coil D

- ##### **mode** *{'half','full'}* sequence mode: half step or full step

- **delay** *{Number}* delay in ms between steps



**Return** *{Object}* StepperUnipolar instance



#### rotate(steps, direction, showStep)

**Parameter(s)**

- **steps** *{Number}* 
- **direction** *{'forward'|'backward"'* 
- **showStep** *{Boolean}* ** to display step in console (default = false)

**Return** *{Promise}* 



#### close()

To disable coils and close rpi-io instances.



## class StepperBipolar

### Electronic wiring example

![](https://raw.githubusercontent.com/gdorbes/rpi-io/refs/heads/master/img/stepper-bipolar.png)

PLEASE NOTE:

- **The junction dot** is where the Pi's 5V pin splits into two wires, tying PUL+ and DIR+ together onto one common rail.

- **STEP and DIR switch low to trigger**, since GPIO pulls PUL- or DIR- down relative to the shared +5V. 

- **Voltage margin is tight**: the Pi's GPIO output high is 3.3V, but the common rail here is 5V, giving only ~1.7V across the optocoupler when "off" — close to some optocouplers' turn-off threshold. Many builds get away with this, but if you see erratic stepping consider using a Darlington array (e.g. ULN2003) between RPi and DM542.

- **ENA+/ENA-** would follow the same common-anode pattern if you wire it — tied into the same 5V junction, with a GPIO pin driving ENA- low to enable.



### Example

See test [script](https://github.com/gdorbes/rpi-io/blob/master/test/stepper-motor-bipolar.js).

```js
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
```



### API

#### constructor StepperBipolar(pul, dir, edge, width)

**Parameter(s)**

- **pul** *{Object}* **rpi-io** instance for pulse pin

- **dir** *{Object}* **rpi-io** instance for direction pin

- ##### **edge** *{'desc','asc'}* pulse active edge: descending or ascending

- **width** *{Number}* pulse width and space between two edges in µs 

**Return** *{Object}* StepperBipolar instance



#### rotate(steps, direction)

**Parameter(s)**

- **steps** *{Number}* 
- **direction** *{'forward'|'backward"'* 
- **showStep** *{Boolean}* ** to display step in console (default = false)

**Return** *{Promise<{elapsedMs: number, pulsesCompleted: number, stopped: boolean}>}* 



#### stop()

To interrupt an ongoing pulse sequence if one is in progress.



#### close()

To disable *pul* and *dir* rpi-io instances.
