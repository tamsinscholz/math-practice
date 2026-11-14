.PHONY: install run test clean clean-all

install:
	@echo "Nothing to install: static HTML/CSS/JS. Tests need node."

run:
	# serve the app at http://localhost:8000 (opening index.html directly also works)
	uv run --no-project python -m http.server 8000

test:
	node --test tests/

clean:
	@echo "Nothing to clean."

clean-all: clean
