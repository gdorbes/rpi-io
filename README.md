# rpi-io
![Static Badge](https://img.shields.io/badge/rpi--io-_2.0.x_-FF5500?style=flat) ![Static Badge](https://img.shields.io/badge/Nodejs-%3E_23-66cc33?logo=nodedotjs&logoColor=white) ![Static Badge](https://img.shields.io/badge/NPM-%3E_10-CC3534?logo=npm&logoColor=white) ![Static Badge](https://img.shields.io/badge/Raspberry_Pi-Zero2_4B_5B-C51A4A?logo=raspberrypi&logoColor=white) ![Static Badge](https://img.shields.io/badge/OS-Bookworm_Trixie-0D7AB9?style=flat)


**rpi-io** is a lite [ESM](https://nodejs.org/api/esm.html#modules-ecmascript-modules) module for **Node.js** to control **Raspberry Pi** GPIO: access (in, out), input event detection and [PWM](https://en.wikipedia.org/wiki/Pulse-width_modulation) peripheral control.

**rpi-io** is built on a high performance hybrid architecture based on Node.js + C addon.

**rpi-io** is designed for recent versions of Raspberry and related OS and middlewares. It has been tested in the following environments:

- Raspberry Pi models: *RPi 5,* *RPi 4B* and *RPi Zero 2.*
- Raspberry Pi OS (64-bit): Debian *Bookworm* and *Trixie*.
- Middlewares (installed by default with OS distribution):
    - Input/Output - [libgpiod](https://libgpiod.readthedocs.io/en/stable/) v1.6.3 (*Bookworm*) and v2.2.1 (*Trixie*)
    - PWM - [sysfs](https://en.wikipedia.org/wiki/Sysfs) interface.

  
## Prerequisites

### libgpiod

By default, *libgpiod* is available with the latest Raspberry Pi OS distributions. If you want to install **rpi-io** with older - not tested - distributions, be sure it is installed.

```bash
sudo apt-get update
sudo apt-get install -y libgpiod-dev gpiod
```

Then check the installed version

```bash
gpioinfo --version
```

### Compilation tools

```bash
sudo apt-get install -y build-essential python3
```

### Node.js

Please make sure that you a recent version of Node.js (v23+) and NPM (v10+).



## Installation

**1. User rights**

To run scripts without `sudo`, add your user to the `gpio` group.

```bash
sudo usermod -a -G gpio $USER
```

Then log out and log back in.

**2. Install the module from your project main directory**

````bash
cd /your-project
npm install rpi-io
````

**3.  Compile C addon from *rpi-io* directory**

```bash
cd /your-project/node_modules/rpi-io/
npm install
```

If you meet errors during this step, stay in the same directory and check your environment.

```bash
npm run check
```

If you need to recompile the module when errors are fixed, stay in the same directory and the run the following scripts.

```bash
npm run clean
npm run install
```



## Configuration for PWM-based peripherals

If you want to use [hardware-based PWM](https://pinout.xyz/pinout/pwm) peripherals, some configuration is required:

- Edit the file  `/boot/firmware/config.txt` and add the required [dtoverlay](https://www.raspberrypi.com/documentation/computers/configuration.html#part3.1) configuration for PWM as showed in the examples below.

```bash
sudo nano /boot/firmware/config.txt
```

```shell
# Examples of PWM configuration to add to/boot/firmware/config.txt
# Default one-channel config: GPIO 18 as channel 0
[all]
dtoverlay=pwm
# Default two-channel config: GPIO 18 as channel 0 and GPIO 19 as channel 1
[all]
dtoverlay=pwm-2chan
# Custom two-channel config: GPIO 12 as channel 0 and GPIO 13 as channel 1
[all]
dtoverlay=pwm-2chan,pin=12,func=4,pin2=13,func2=4
```

- Reboot the Raspberry Pi.
- Test the PWM configuration.

```shell
# Testing PWM configuration after reboot
pinctrl get 12
# 12: a0    pd | lo // GPIO12 = PWM0_CHAN0
pinctrl get 13
# 13: a0    pd | lo // GPIO13 = PWM0_CHAN1
```



## Usage

PLEASE NOTE: In all this document, GPIO line numbers are the BCM ones as defined in https://pinout.xyz/.

### *OUT* operations

#### Example of LED control
##### Diagram
```
GPIO Pin (Output)
          │
         ┌┴┐
         │ │  Current-limiting resistor (220Ω or 330Ω)
         └┬┘
          │
          ▼   ← LED (anode +)
         ───
          |   ← LED (cathode -)
          |
        ─────  GND (0V)
          ─
```

##### Code example

```javascript
// Import rpi-io module
import {RIO} from "rpi-io"

// Define instance for OUT operation on some GPIO e.g. 17 with initial value
const led = new RIO(17, "output", {value: 0})

// Turn the led on
led.write(1)

// Turn the led off after 5s and close the instance before leaving
setTimeout(()=>{
    led.write(0)
    led.close()
}, 5000)
```



### *IN* operations

#### Getting button status and listening to input events

##### Diagram of *pull-down* electronic circuit

```
VCC (3.3V)
          │
          ○  ← Switch/Button (open = not pressed)
          │
          ├──────────── GPIO Pin
          │
         ┌┴┐
         │ │  Pull-down resistor (10kΩ typical)
         └┬┘
          │
        ─────  GND (0V)
          ─
```

##### Code example

```javascript
// Import rpi-io module
import {Rio, ctrlC} from "rpi-io"

// Define instance for IN operation on some GPIO e.g. 18
const btn = new RIO(18, "input", {bias: "pull-down"})

// Close instance on script interrupt
ctrlC(() => {
    btn.close()
})

// Instant read
console.log("button value:", btn.read())

// Event monitoring for both edges ("rising"/"falling") with rebounce threshold (30)
const callback = edge => {console.log("edge:", edge)}
btn.monitoringStart(callback, "both", 30)

// Stop monitoring after 10s
setTimeout(()=>{
    btn.monitoringStop()
}, 10000)
```

##### *Pull-up* variant

```
VCC (3.3V)
          │
         ┌┴┐
         │ │  Pull-up resistor (10kΩ typical)
         └┬┘
          │
          ├──────────── GPIO Pin
          │
          ○  ← Switch/Button (open = not pressed)
          │
        ─────  GND (0V)
          ─
```

```javascript
const btn = new RIO(18, "input", {bias: "pull-up"})
```



### PWM operations in hardware mode

#### Servo motor

REMINDER: PWM peripherals used in hardware mode need some specific [configuration](## Configuration for PWM-based peripherals).

##### Diagram for servo-motor *SG90*
```
                                    ┌─────────────────────┐
                                    │                     │
        External Power (5V)         │    Servo Motor      │
              │                     │                     │
              │    VCC (red)        │  ┌───────────────┐  │
              ├────────────────────────┤               │  │
              │                     │  │     Motor     │  │
              │    GND (brown/black)│  └───────┬───────┘  │
              ├────────────────────────────────┤          │
              │                     │    ┌─────┴─────┐    │
              │                     │    │   Gear    │    │
              │                     │    │   Box     │    │
              │                     │    └─────┬─────┘    │
              │                     │     ─────┴─────     │
              │                     │    ( Servo Arm )    │
              │    Signal (orange)  │                     │
 GPIO Pin ─────────────────────────────                   │
   (PWM)                            │                     │
              │                     └─────────────────────┘
              │
            ─────  Common GND ← Important: Pi GND must connect here
              ─
```

##### Code example

```javascript
import {RIO, sleep, ctrlC, } from "rpi-io"

(async () => {
  
    // Init pwm line (13) and set duty range in µs
    const servo = new RIO(13, "pwm", {
        period: 20000,  // 20,000,000 ns ~ 50 Hz
        dutyMin: 500,   //    500,000 ns ~ 0.5 ms
        dutyMax: 2500   //  2,500,000 ns ~ 2.5 ms
    })
    ctrlC(() => {
        servo.close()
    })

    await sleep(2000)
    servo.pwmDuty(50)
    console.log("servo duty = 50%")     // ~ 0.5 + (0.5 * (2.5 ms - 0.5 ms)) = 1.5 ms
    await sleep(2000)
    servo.pwmDuty(100)
    console.log("servo duty = 100%")    // ~ 0.5 + (1.0 * (2.5 ms - 0.5 ms)) = 2.5 ms
    await sleep(2000)
    servo.pwmDuty(0)
    console.log("servo duty = 0%")      // ~ 0.5 + (0.0 * (2.5 ms - 0.5 ms)) = 0.5 ms
    await sleep(2000)
    servo.close()
    console.log("servo closed")
})()
```

##### Fade-in LED

PWM can also be used for progressive LED light with the same electronic circuit as write operations. See example below.

```javascript
import {RIO, sleep, ctrlC, } from "rpi-io"
(async () => {
    // Init pwm line 12 and duty range in µs
    const led = new RIO(12, "pwm", {
        period: 1000,  // 1,000,000 ns ~ 1 KHz
        dutyMin: 0,
        dutyMax: 1000
    })
 
    ctrlC(() => {
        led.close()
    })

    for (let i = 1; i < 101; i++) {
        led.pwmDuty(i)
        await sleep(30, false)
    }
    await sleep(2000, false)
    led.pwmDuty(0)
    led.close()
    log("led closed")
})()
```

### More examples

To get familiar with the module, you might have a glance on examples and play with them with the GPIO lines of your own electronic circuit.

```bash
# Simple write
node /your-project/node_modules/rpi-io/test/write.js

# Read and monitor
node /your-project/node_modules/rpi-io/test/read.js

# LED fade-in on PWM line
node /your-project/node_modules/rpi-io/test/pwm-led.js

# Servo-motor SG90 controlled by PWM
node /your-project/node_modules/rpi-io/test/pwm-motor.js

# Test duplicated instance error
node /your-project/node_modules/rpi-io/test/duplicate-error.js

# Test close of all instances
node /your-project/node_modules/rpi-io/test/close-all.js

# Test GPIO line configuration
node /your-project/node_modules/rpi-io/test/line-configuration.js
```



## API

The **rpi-io** API is based on the class `RIO` with instance methods.

### RIO class and methods

####  constructor RIO(line, mode, opt)
To create instance according to parameters.
##### Example
```javascript
import {RIO} from "rpi-io"
const myOutput = new RIO(17, "output")
```
##### Parameter(s)
- **line** *{Number}*  Must be one of the GPIO number as defined in [pinout.xyz](https://pinout.xyz). 
- **mode** *{String}* Must be one of the following values: "output", "input", "pwm".
- **opt** *{Object}* Various options depending on selected mode. See details and default values below.

```javascript
{
  // output - Initial value
  value: 0,
  // input - Circuit bias: "disable", "pull-up", "pull-down"
  bias: "disable",
  // pwm - Delay time (ms) required on instance creation
  //			 depending on device performance. If this value is
  //       too small, the PWM instance creation fails.
  //			 Can be reduced for latest RPi 5
  //			 Must be increased for old RPi Zero.
  exportTime: 100,
  // pwm - period defined in μs. Default value is equivalent
  //			 to a 50 Hz frequency.
  period: 20000,
  // pwm - dutyMin and dutyMax defines the duty cycle use range in µs
  // 		   especially for servo-motors (See their specs!).
  dutyMin: 0,
  dutyMax: 20000
}
```

##### Return

*{Object}*  RIO instance



#### close()
To close instance i.e.

- to prevent future use of the line with the current instance
- to stop related monitoring process if any
- to free PWM resources if any

To reuse a line when closed, a new instance must be created.

##### Example

```javascript
import {RIO} from "rpi-io"
const myOutput = new RIO(17, "output")
myOutput.close()
```



#### write(value)

To write some value to "output" instance.

##### Example

```javascript
import {RIO} from "rpi-io"
const myOutput = new Rio(17, "output")
myOuput.write(1)
```

##### Parameter(s)

- **value** *{Number}*  0 or 1



#### read()

To read value from "input" instance.

##### Example

```javascript
import {RIO} from "rpi-io"
const myInput = new Rio(18, "input")
const result = myInput.read()
```

##### Return

*{Number}*  0 or 1



#### monitoringStart(callback, edge, bounce)

To start event monitoring of "input" instance.

##### Example

```javascript
import {RIO} from "rpi-io"
const myButton = new Rio(18, "input")
const callback = edge => {
    console.log("edge:", edge)
}
myButton.monitoringStart(callback, "both", 30)
```

##### Parameter(s)

- **callback** *{Function}*  Function triggered by input events where parameter is *edge* that can be either "rising" (input change from 0 to 1) or "falling" (input change from 1 to 0).
- **edge** *{String}* Filter of monitored events: "rising", "falling", "both" (default value).
- **bounce** *{Number}* Set threshold in ms to filter consecutive events of same type. Default value is 0.



#### monitoringStop()

To stop event monitoring of "input" instance.

##### Example

```javascript
import {RIO} from "rpi-io"
const myButton = new Rio(18, "input")
const callback = 
myButton.monitoringStart(edge => {console.log("edge:", edge)})
// Stop monitoring after 10s
setTimeout(() => {
  myButton.monitoringStop()
}, 10000)
```



#### pwmDuty(percent)

To change the *duty cycle* of a "pwm" instance. The parameter is defined as a percentage to compute a *duty cycle* based on the *dutyMin* and *dutyMax* values of instance definition.

##### Example

```javascript
import {RIO} from "rpi-io"
// Servo-motor instance
const servo = new RIO(13, "pwm", {
        exportTime: 100,
        period: 20000,
        dutyMin: 500,
        dutyMax: 2500})

// duty cycle = 50% between dutyMin and dutyMax
servo.pwmDuty(50)
```

##### Parameter(s)

- **percent** *{Number}*   0 ≤ percent ≤ 100



### Utilities

####  RIO.closeAll()
Function to close all instances
##### Example
```javascript
import {RIO} from "rpi-io"
const led = new RIO(17, "output", {value: 0})
const btn = new RIO(18, "input")
RIO.closeAll()
// led and btn are closed 
```



####  log(args)

Function similar to `console.log` but with timestamped prompt. Must be enabled or not by function `traceCfg` defined thereafter.

####  warn(args)

Function similar to `log` but colored and prefixed by sign ⚠️.

####  traceCfg(level)

Function to enable functions `log` and `warn`. 

##### Example for log, warn and traceCfg

```javascript
import {traceCfg, log, warn} from "rpi-io"
// traceCfg(0) => warn and log are disabled
// traceCfg(1) => warn is enabled and log is disabled
// traceCfg(2) => warn and log are enabled
traceCfg(2)
warn("This is important info") 
log("This is useful info")
```



####  sleep(time)

Similar to `setTimeout` but in async mode.

####  ctrlC(function)

To run a callback function on ctrl+c event.

##### Example for sleep and ctrlC

```javascript
import {sleep, ctrlC} from "rpi-io"
(async () => {
    ctrlC(() => {
        console.log("displayed on script interrupt")
    })
    await sleep(10000)
    console.log("displayed after 10s")
})()
```




## Benchmark

The following tables summarize main operation times on various devices. Results are in micro-seconds (µs).

**PLEASE NOTE**: As PWM operations rely on files, performance of microSD cards installed on RPi may have a significant impact on results for `pwmDuty()`.

**OS Bookworm with libgpiod v1.6.3**

|                 | RPi 5B  | RPi 4B  | RPi Zero2 |
| --------------- | ------- | ------- | --------- |
| write           | 0.72 µs | 1.30 µs | 2,37 µs   |
| read            | 1.32 µs | 1,09 µs | 1,90 µs   |
| pwmDuty (1 KHz) | 15.6 µs | 25,6 µs | 48,4 µs   |

**OS Trixie with libgpiod v2.2.1**

|                 | RPi 5B       | RPi 4B  | RPi Zero2    |
| --------------- | ------------ | ------- | ------------ |
| write           | *not tested* | 1.20 µs | *not tested* |
| read            | *not tested* | 1.37 µs | *not tested* |
| pwmDuty (1 KHz) | *not tested* | 24,9 µs | *not tested* |



## Licence

MIT

