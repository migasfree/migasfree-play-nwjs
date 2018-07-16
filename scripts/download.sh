set -e

PATH=$PATH:/usr/local/bin

if [ "$DEB_BUILD_ARCH_BITS" = "32" ]; then
	_ARCH="ia32"
else
	_ARCH="x64"
fi
_FILENAME=nwjs-v0.31.2-linux-$_ARCH


cd usr/share/migasfree-play
npm set strict-ssl false
npm install

wget -O --no-check-certificate nwjs.tar.gz https://dl.nwjs.io/v0.31.2/$_FILENAME.tar.gz

