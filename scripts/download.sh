set -e

PATH=$PATH:/usr/local/bin

if [ "$DEB_BUILD_ARCH_BITS" = "32" ]; then
    _ARCH="ia32"
else
    _ARCH="x64"
fi

cd usr/share/migasfree-play
npm install

echo "Downloading nwjs-v${_NWJS_VERSION}-linux-${_ARCH}.tar.gz"
wget --no-check-certificate --quiet --tries=3 -O nwjs.tar.gz https://dl.nwjs.io/v${_NWJS_VERSION}/nwjs-v${_NWJS_VERSION}-linux-${_ARCH}.tar.gz
