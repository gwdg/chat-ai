#!/bin/bash -e
cd $(dirname $0)

docker run -it --rm --user $(id -u):$(id -g) -v $PWD/../../:/home/opencode/code gwdg-opencode:last
