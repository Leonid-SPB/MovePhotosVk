#!/bin/sh
rm -rf ../prod/*
cp -R ../source/* ../prod/
cd ../prod
for ff in *.js
do
  uglifyjs $ff -m -o $ff
done
