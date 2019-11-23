#!/bin/bash

rm -rf docs/bundle-*
cd evolver-webgl-ts
rm -rf dist
yarn run build
cd ..
cp -r evolver-webgl-ts/dist/* docs/
cp docs/index.html docs/404.html
