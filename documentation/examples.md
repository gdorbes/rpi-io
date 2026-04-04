# Examples
To get familiar with the **rpi-io**, you might have a glance on examples and play with them with the GPIO lines of your own electronic circuit.

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
