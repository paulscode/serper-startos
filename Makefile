PKG_ID := serper
PKG_VERSION := 1.0.1
TS_FILES := $(shell find ./ -name \*.ts)

.DELETE_ON_ERROR:

all: verify

verify: $(PKG_ID).s9pk
	@start-sdk verify s9pk $(PKG_ID).s9pk
	@echo " Done!"
	@echo "   Filesize: $(shell du -h $(PKG_ID).s9pk) is ready"

install:
	@if [ ! -f ~/.embassy/config.yaml ]; then echo "You must define \"host: http://server-name.local\" in ~/.embassy/config.yaml config file first."; exit 1; fi
	@echo "\nInstalling to $$(grep -v '^#' ~/.embassy/config.yaml | cut -d'/' -f3) ...\n"
	@[ -f $(PKG_ID).s9pk ] || ( $(MAKE) && echo "\nInstalling to $$(grep -v '^#' ~/.embassy/config.yaml | cut -d'/' -f3) ...\n" )
	@start-cli package install $(PKG_ID).s9pk

arm:
	@rm -f docker-images/x86_64.tar
	ARCH=aarch64 $(MAKE)

x86:
	@rm -f docker-images/aarch64.tar
	ARCH=x86_64 $(MAKE)

clean:
	rm -rf docker-images
	rm -f $(PKG_ID).s9pk
	rm -f scripts/*.js

clean-model:
	rm -f models/ProtectAI/deberta-v3-base-prompt-injection-v2/onnx/model_quantized.onnx

# Build the embassy.js from TypeScript
scripts/embassy.js: $(TS_FILES)
	deno run --allow-read --allow-write --allow-env --allow-net scripts/bundle.ts

# Fetch ML model if not present
models/ProtectAI/deberta-v3-base-prompt-injection-v2/onnx/model_quantized.onnx:
	@echo "Fetching ML model..."
	@bash scripts/fetch-model.sh

# Build Docker images for each architecture
docker-images/x86_64.tar: Dockerfile docker_entrypoint.sh settings.yml bridge/**/* models/ProtectAI/deberta-v3-base-prompt-injection-v2/onnx/model_quantized.onnx
ifeq ($(ARCH),aarch64)
else
	mkdir -p docker-images
	docker buildx build --tag start9/$(PKG_ID)/main:$(PKG_VERSION) --platform=linux/amd64 -o type=docker,dest=docker-images/x86_64.tar .
endif

docker-images/aarch64.tar: Dockerfile docker_entrypoint.sh settings.yml bridge/**/* models/ProtectAI/deberta-v3-base-prompt-injection-v2/onnx/model_quantized.onnx
ifeq ($(ARCH),x86_64)
else
	mkdir -p docker-images
	docker buildx build --tag start9/$(PKG_ID)/main:$(PKG_VERSION) --platform=linux/arm64 -o type=docker,dest=docker-images/aarch64.tar .
endif

# Package everything into .s9pk
$(PKG_ID).s9pk: manifest.yaml instructions.md LICENSE icon.png scripts/embassy.js docker-images/aarch64.tar docker-images/x86_64.tar
	@echo "\n\nBuilding $(PKG_ID).s9pk\n"
	@start-sdk pack
