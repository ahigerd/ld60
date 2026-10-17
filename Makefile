dist: $(wildcard *.js) $(wildcard html52d/*.js) $(wildcard *.css) index.html | FORCE
	mkdir -p dist
	cp -r index.html *.js *.css html52d dist/

clean:
	rm -rf dist

PORT=8000
server:
	python -m http.server $(PORT)

FORCE:
