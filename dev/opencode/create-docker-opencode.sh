#!/bin/bash -e

cd $(dirname $0)

cp $HOME/.config/opencode/opencode.json .
cp $HOME/.local/share/opencode/auth.json .

docker build -t gwdg-opencode:last -f Dockerfile-opencode --build-arg UID=$(id -u) --build-arg GID=$(id -g) --progress plain .

rm opencode.json auth.json

