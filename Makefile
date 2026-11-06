.PHONY: all test serve

all: test

test:
	sh tests/check.sh

serve:
	node serve.js
