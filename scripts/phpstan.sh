#!/bin/sh
set -eu

exec php83 /usr/local/bin/phpstan.phar "$@"
