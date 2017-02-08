all:
	@echo "~~~~~~~ gs-webaudio-library ~~~~~~~~~"
	@echo -n "* JS ..... "
	@uglifyjs $(SRC) -o bin/gs-webaudio-library.min.js --compress --mangle
	@echo "gs-webaudio-library.min.js"
	@echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

.PHONY: all

SRC = \
	src/gswaBufferSample.js       \
	src/gswaEncodeWAV.js          \
	src/gswaSampleGroup.js
