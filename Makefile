all: zip extension

delete-all-hidden:
	cd source; find . -name '.??*' -exec rm -rf {} \;

zip: delete-all-hidden
	rm source.zip; zip -r source.zip source

extension: delete-all-hidden
	/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --pack-extension=`pwd`/source --pack-extension-key=`pwd`/source.pem
	mv source.crx extension.crx
