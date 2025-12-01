{
  "targets": [
    {
      "target_name": "gpio",
      "sources": [ "addon/gpio.c" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "libraries": [
        "-lgpiod",
        "-lpthread"
      ],
      "cflags": [
        "-Wall",
        "-Wno-implicit-function-declaration",
        "-Wno-incompatible-pointer-types",
        "-O2",
        "-std=gnu99"
      ],
      "defines": [
        "<!@(sh -c 'chmod +x script/detect-gpiod-version.sh 2>/dev/null; bash script/detect-gpiod-version.sh 2>/dev/null || echo LIBGPIOD_V2')"
      ]
    }
  ]
}
