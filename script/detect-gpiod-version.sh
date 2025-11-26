#!/bin/bash
# -------------------------------------------------------------------
# RPI-IO: To detect the libgpiod version
# -------------------------------------------------------------------

VERSION=$(pkg-config --modversion libgpiod 2>/dev/null)

if [ -z "$VERSION" ]; then
    echo "Error: Cannot detect libgpiod version" >&2
    exit 1
fi

MAJOR=$(echo $VERSION | cut -d. -f1)

echo "Detected libgpiod version: $VERSION (major: $MAJOR)" >&2

if [ "$MAJOR" -ge 2 ]; then
    echo "LIBGPIOD_V2"
else
    echo "LIBGPIOD_V1"
fi
