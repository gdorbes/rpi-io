# rpi-io
![Static Badge](https://img.shields.io/badge/rpi--io-_2.1.x_-FF5500?style=flat) ![Static Badge](https://img.shields.io/badge/Nodejs-%3E_23-66cc33?logo=nodedotjs&logoColor=white) ![Static Badge](https://img.shields.io/badge/NPM-%3E_10-CC3534?logo=npm&logoColor=white) ![Static Badge](https://img.shields.io/badge/Raspberry_Pi-Zero2_4B_5B-C51A4A?logo=raspberrypi&logoColor=white) ![Static Badge](https://img.shields.io/badge/OS-Bookworm_Trixie-0D7AB9?style=flat)

Current version is 2.1.1. More details in [CHANGELOG.md](CHANGELOG.md).

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

Please make sure that you a recent version of Node.js.  Recommended tested versions are v23 and further as they support `require(esm)` by default.

Older versions starting at v20.19 where `require(esm)` has been backported should work as well, but they haven't been tested extensively.

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
If the error is an alert about high-level vulnerabilities related to the *tar* module,
- be sure that you are installing **rpi-io** version 2.0.8 or more,
- follow the NPM recommendation to run `npm audit fix --force` to install the appropriate version of *node-gyp*.

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
import {RIO, ctrlC} from "rpi-io"

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

REMINDER: PWM peripherals used in hardware mode need some specific [configuration](# Configuration for PWM-based peripherals).

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

#### Fade-in LED

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

## More documentation
- [Examples](documentation/examples.md)
- [API reference guide](documentation/api.md)
- [Benchmark](documentation/benchmark.md)

## Licence

MIT

