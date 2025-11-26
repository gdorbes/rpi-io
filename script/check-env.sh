#!/bin/bash
# -------------------------------------------------------------------
# RPI-IO: Script to check environment for libgpiod
# source: claude.ai/chat/f3139163-e976-47a4-8e46-01fee65686f2
# Check: OS, Node.js, npm, node-gyp, gcc, make, Python, libgpiod
#        gpio permissions, pthread
# -------------------------------------------------------------------
echo "=== Check environment for libgpiod ==="
echo ""

RED="\033[0;31m"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check OS
echo "1. Operating system"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    check_ok "OS: $PRETTY_NAME"
else
    check_warn "Impossible to detect OS"
fi
echo ""

# Check Node.js
echo "2. Node.js"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_ok "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js is not installed"
    echo "   Install it with: sudo apt-get install nodejs"
fi
echo ""

# Check npm
echo "3. npm"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_ok "npm installed: v$NPM_VERSION"
else
    check_fail "npm is not installed"
fi
echo ""

# Check node-gyp
echo "4. node-gyp"
if npm list -g node-gyp &> /dev/null; then
    check_ok "node-gyp is installed globally"
elif npm list node-gyp &> /dev/null; then
    check_ok "node-gyp is installed locally"
else
    check_warn "node-gyp is not detected (it will be installed by npm install)"
fi
echo ""

# Check gcc
echo "5. Compile tools"
if command -v gcc &> /dev/null; then
    GCC_VERSION=$(gcc --version | head -n1)
    check_ok "gcc is installed: $GCC_VERSION"
else
    check_fail "gcc is not installed"
    echo "   Install it with: sudo apt-get install build-essential"
fi

if command -v make &> /dev/null; then
    check_ok "make is installed"
else
    check_fail "make is not installed"
fi
echo ""

# Check Python (required by node-gyp)
echo "6. Python (required by node-gyp)"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    check_ok "$PYTHON_VERSION"
else
    check_fail "Python 3 is not installed"
fi
echo ""

# Check libgpiod
echo "7. libgpiod"
if command -v gpioinfo &> /dev/null; then
    GPIOD_VERSION=$(gpioinfo --version 2>&1 | head -n1)
    check_ok "libgpiod is installed: $GPIOD_VERSION"
else
    check_fail "libgpiod is not installed"
    echo "   Install with: sudo apt-get install gpiod"
fi

if [ -f /usr/include/gpiod.h ]; then
    check_ok "Headers libgpiod trouvés: /usr/include/gpiod.h"

    # Détect header version
    if grep -q "GPIOD_API_VERSION" /usr/include/gpiod.h; then
        check_ok "libgpiod v2.x detected (GPIOD_API_VERSION found)"
    else
        check_ok "libgpiod v1.x detected"
    fi
else
    check_fail "libgpiod headers not found"
    echo "   Install it with: sudo apt-get install libgpiod-dev"
fi

if [ -f /usr/lib/aarch64-linux-gnu/libgpiod.so ] || [ -f /usr/lib/arm-linux-gnueabihf/libgpiod.so ] || [ -f /usr/lib/x86_64-linux-gnu/libgpiod.so ]; then
    check_ok "libgpiod lib found"
else
    check_fail "libgpiod lib not found"
fi
echo ""

# Check GPIO permissions
echo "8. Permissions GPIO"
if [ -e /dev/gpiochip0 ]; then
    check_ok "/dev/gpiochip0 found"

    if groups $USER | grep -q gpio; then
        check_ok "User $USER is in the gpio group"
    else
        check_warn "User $USER is not in the gpio group"
        echo "   Add him/her with: sudo usermod -a -G gpio $USER"
        echo "   Then log back in."
    fi

    ls -l /dev/gpiochip0
else
    check_warn "/dev/gpiochip0 is not found (==> not a Raspberry Pi)"
fi
echo ""

# Check pthread
echo "9. pthread"
if [ -f /usr/include/pthread.h ]; then
    check_ok "pthread.h found"
else
    check_warn "pthread.h not found ⚠️"
fi
echo ""

# Summary
echo "=== Summary ==="
echo ""

MISSING=0

if ! command -v node &> /dev/null; then
    echo "➤ Install Node.js:"
    echo "  sudo apt-get install nodejs npm"
    MISSING=1
fi

if ! command -v gcc &> /dev/null; then
    echo "➤ Install compilation tools:"
    echo "  sudo apt-get install build-essential python3"
    MISSING=1
fi

if ! [ -f /usr/include/gpiod.h ]; then
    echo "➤ Install libgpiod and related headers:"
    echo "  sudo apt-get install libgpiod-dev gpiod"
    MISSING=1
fi

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✓ All the prerequisites seem to be in place!${NC}"
    echo ""
    echo "Now you can compile with:"
    echo "  npm install"
else
    echo -e "${YELLOW}⚠️ Some prerequisites are missing (see above)${NC}"
fi

echo ""
echo "To force recompilation:"
echo "  npm run clean"
echo "  npm run build"