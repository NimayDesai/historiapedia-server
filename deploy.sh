#!/bin/bash

echo What should the version be?
read VERSION

docker build -t ninud/historiapedia:$VERSION .
docker push ninud/historiapedia:$VERSION
ssh root@134.122.42.225 "docker pull ninud/historiapedia:$VERSION && docker tag ninud/historiapedia:$VERSION dokku/api:$VERSION && dokku tags:deploy api $VERSION"