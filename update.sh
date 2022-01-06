docker-compose down -v
cd ..
sudo rm release.zip
sudo wget https://github.com/$(wget https://github.com/AdrianGonz97/Bits2Ban-Twitch-Bot/releases/latest -O - | egrep '/.*/.*/.*zip' -o)
sudo unzip release.zip
cd releases
docker-compose build
docker-compose up -d