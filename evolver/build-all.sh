#!/bin/bash

echo "Building linux executable"
GOOS=linux GOARCH=amd64 go build -o evolver-linux
echo "Building mac executable"
GOOS=darwin GOARCH=amd64 go build -o evolver-mac
echo "Building windows executable"
GOOS=windows GOARCH=amd64 go build -o evolver.exe
echo "Build complete"
