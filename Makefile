include .env
export

.PHONY: all clean

all: migasfree-play

clean:
	rm -rf usr/share/migasfree-play/node_modules
	rm -rf usr/share/migasfree-play/nwjs

migasfree-play:
	./scripts/download.sh
