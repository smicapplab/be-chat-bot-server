#!/bin/bash

echo "Upgrading dependencies"
rm -rvf node_modules/
rm package-lock.json
ncu -u
npm install