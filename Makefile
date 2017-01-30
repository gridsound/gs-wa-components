all:
	@echo "~~~~~~~ gs-webaudio-library ~~~~~~~~~"
	@echo -n "* JS ..... "
	@uglifyjs $(SRC) -o bin/gs-webaudio-library.min.js --compress --mangle
	@echo gs-webaudio-library.min.js
	@echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

.PHONY: all

SRC = \
	src/gswaBufferSample.js       \
	src/gswaSampleGroup.js        \
	                              \
	src/gswaContext.js            \
	src/gswaEncodeWAV.js          \
	src/gswaSample.js             \
	src/gswaBuffer.js             \
	src/gswaFilters.js            \
	src/gswaComposition.js        \
	src/gswaComposition.loop.js   \
	src/gswaComposition.render.js
