dpkg -l|grep 'ii  npm ' > /dev/null
if [ $? != 0 ]
then
  echo "please, install npm: apt-get install npm" 
  exit
fi

rm -rf usr/share/migasfree-play
mkdir -p usr/share/migasfree-play
cp -r ../src/* usr/share/migasfree-play/
cd usr/share/migasfree-play/
npm install
cd -
/usr/bin/debuild --no-tgz-check -us -uc
mkdir -p ../dist
mv ../migasfree*.deb ../dist
rm ../migasfree-play*.dsc
rm ../migasfree-play*.tar.xz
rm ../migasfree-play*.build
rm -rf ../migasfree-play*.changes
