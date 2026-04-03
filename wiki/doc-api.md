# rpi-io API documenation
The **rpi-io** API is based on the class `RIO` with instance methods and a few static functions and utilities

## RIO class and methods

### constructor RIO(line, mode, opt)

To create instance according to parameters.
#### Example
```javascript
import {RIO} from "rpi-io"
const myOutput = new RIO(17, "output")
```
#### Parameter(s)
- **line** *{Number}*  Must be one of the GPIO number as defined in [pinout.xyz](https://pinout.xyz). 
- **mode** *{String}* Must be one of the following values: "output", "input", "pwm".
- **opt** *{Object}* Various options depending on selected mode. See details and default values below.

```javascript
{
  // For 'output' mode: Initial value {0,1}.
  value: 0,
    
  // For 'input' mode: Circuit bias {"disable", "pull-up", "pull-down"}.
  bias: "disable",
    
  // For 'pwm' mode: Delay (ms) required on instance creation
  // to prevent failure due to device performance.
  //
  // Since v2.1.0 the default value is set to -1, which means auto delay.
  // It is computed according to device model e.g. 50 ms for 5Pi or 1000 ms RPi Zero.
  exportTime: -1,
    
  // For 'pwm' mode: Period defined in μs. Default value is equivalent to 50 Hz.
  period: 20000,
    
  //  For 'pwm' mode: dutyMin and dutyMax defines the duty cycle use range in µs
  // 		   especially for servo-motors (See their specs!).
  dutyMin: 0,
  dutyMax: 20000
}
```

#### Return

*{Object}*  RIO instance



### close()
To close instance i.e.

- to prevent future use of the line with the current instance
- to stop related monitoring process if any
- to free PWM resources if any

To reuse a line when closed, a new instance must be created.

#### Example

```javascript
import {RIO} from "rpi-io"
const myOutput = new RIO(17, "output")
myOutput.close()
```



### write(value)

To write some value to "output" instance.

#### Example

```javascript
import {RIO} from "rpi-io"
const myOutput = new RIO(17, "output")
myOuput.write(1)
```

#### Parameter(s)

- **value** *{Number}*  0 or 1



### read()

To read value from "input" instance.

#### Example

```javascript
import {RIO} from "rpi-io"
const myInput = new RIO(18, "input")
const result = myInput.read()
```

#### Return

*{Number}*  0 or 1



### monitoringStart(callback, edge, bounce)

To start event monitoring of "input" instance.

#### Example

```javascript
import {RIO} from "rpi-io"
const myButton = new RIO(18, "input")
const callback = edge => {
    console.log("edge:", edge)
}
myButton.monitoringStart(callback, "both", 30)
```

#### Parameter(s)

- **callback** *{Function}*  Function triggered by input events where parameter is *edge* that can be either "rising" (input change from 0 to 1) or "falling" (input change from 1 to 0).
- **edge** *{String}* Filter of monitored events: "rising", "falling", "both" (default value).
- **bounce** *{Number}* Set threshold in ms to filter consecutive events of same type. Default value is 0.



### monitoringStop()

To stop event monitoring of "input" instance.

#### Example

```javascript
import {RIO} from "rpi-io"
const myButton = new RIO(18, "input")
const callback = 
myButton.monitoringStart(edge => {console.log("edge:", edge)})
// Stop monitoring after 10s
setTimeout(() => {
  myButton.monitoringStop()
}, 10000)
```



### pwmDuty(percent)

To change the *duty cycle* of a "pwm" instance. The parameter is defined as a percentage to compute a *duty cycle* based on the *dutyMin* and *dutyMax* values of instance definition.

#### Example

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

#### Parameter(s)

- **percent** *{Number}*   0 ≤ percent ≤ 100

## Static functions

###  RIO.closeAll()
Function to close all instances
#### Example
```javascript
import {RIO} from "rpi-io"
const led = new RIO(17, "output", {value: 0})
const btn = new RIO(18, "input")
RIO.closeAll()
// led and btn are closed 
```



### RIO.model()

Function to return current model of RPi.

```javascript
import {RIO} from "rpi-io"
console.log("model:", RIO.model())
// Returns '5B', '4B', '3B', 'Zero2', 'Zero' or '' when unknown.
```

## Utilities

###  log(args)

Function similar to `console.log` but with timestamped prompt. Must be enabled or not by function `traceCfg` defined thereafter.

###  warn(args)

Function similar to `log` but colored and prefixed by sign ⚠️.

###  traceCfg(level)

Function to enable functions `log` and `warn`. 

#### Example for log, warn and traceCfg

```javascript
import {traceCfg, log, warn} from "rpi-io"
// traceCfg(0) => warn and log are disabled
// traceCfg(1) => warn is enabled and log is disabled
// traceCfg(2) => warn and log are enabled
traceCfg(2)
warn("This is important info") 
log("This is useful info")
```



###  sleep(time)

Similar to `setTimeout` but in async mode.

###  ctrlC(function)

To run a callback function on ctrl+c event.

#### Example for sleep and ctrlC

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

# End of File
