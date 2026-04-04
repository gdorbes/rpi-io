# Benchmark

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

