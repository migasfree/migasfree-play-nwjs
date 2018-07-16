set -e

PATH=$PATH:/usr/local/bin

if [ "$DEB_BUILD_ARCH_BITS" = "32" ]; then
	_ARCH="ia32"
else
	_ARCH="x64"
fi
_NWJS_VERSION=0.31.2


cd usr/share/migasfree-play
npm set strict-ssl false
npm install

wget --no-check-certificate -O nwjs.tar.gz https://dl.nwjs.io/v${_NWJS_VERSION}/nwjs-v${_NWJS_VERSION}-linux-${_ARCH}.tar.gz