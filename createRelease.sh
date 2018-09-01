#!/usr/bin/env bash

cd "${BASH_SOURCE%/*}" || exit
rm download.zip
zip -r download.zip . -x .git/\* .gitignore .jshintrc .jsbeautifyrc ./\*\*/.DS_Store createRelease.sh
