#!/usr/bin/env bash
# =============================================================================
# Fetch and quantize the ML prompt injection detection model
#
# Downloads the ProtectAI DeBERTa model from HuggingFace, quantizes the
# ONNX weights to uint8, and stages the files for the Docker build.
#
# Prerequisites: Python 3.8+ with pip (onnx, onnxruntime installed if needed)
#
# Usage:
#   ./scripts/fetch-model.sh
# =============================================================================

set -euo pipefail

MODEL_ID="ProtectAI/deberta-v3-base-prompt-injection-v2"
MODEL_DIR="models/${MODEL_ID}"
ONNX_DIR="${MODEL_DIR}/onnx"
HF_BASE="https://huggingface.co/${MODEL_ID}/resolve/main"

# Files needed by transformers.js (tokenizer + config at model root)
ROOT_FILES=(
  config.json
  tokenizer.json
  tokenizer_config.json
  special_tokens_map.json
  added_tokens.json
)
# SentencePiece model
SPM_FILE="spm.model"
# Source ONNX model (fp32)
ONNX_SOURCE="onnx/model.onnx"

echo "=== ML Model Fetch & Quantize ==="
echo "Model: ${MODEL_ID}"
echo ""

# Check if quantized model already exists
if [ -f "${ONNX_DIR}/model_quantized.onnx" ]; then
  echo "Quantized model already exists at ${ONNX_DIR}/model_quantized.onnx"
  echo "Delete it to re-download and re-quantize."
  exit 0
fi

mkdir -p "${MODEL_DIR}" "${ONNX_DIR}"

# Download root files
for f in "${ROOT_FILES[@]}" "${SPM_FILE}"; do
  if [ ! -f "${MODEL_DIR}/${f}" ]; then
    echo "Downloading ${f}..."
    curl -fSL -o "${MODEL_DIR}/${f}" "${HF_BASE}/${f}"
  else
    echo "Already have ${f}"
  fi
done

# Download fp32 ONNX model
ONNX_FP32="${ONNX_DIR}/model.onnx"
if [ ! -f "${ONNX_FP32}" ]; then
  echo "Downloading onnx/model.onnx (this is ~738MB)..."
  curl -fSL -o "${ONNX_FP32}" "${HF_BASE}/${ONNX_SOURCE}"
else
  echo "Already have onnx/model.onnx"
fi

# Quantize to uint8
echo "Quantizing to uint8 (this may take a minute)..."
python3 -c "
from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic(
    '${ONNX_FP32}',
    '${ONNX_DIR}/model_quantized.onnx',
    weight_type=QuantType.QUInt8,
)
print('Quantization complete')
"

# Remove the large fp32 model — only the quantized version is needed
rm -f "${ONNX_FP32}"

echo ""
QSIZE=$(du -h "${ONNX_DIR}/model_quantized.onnx" | cut -f1)
echo "Done! Quantized model: ${ONNX_DIR}/model_quantized.onnx (${QSIZE})"
echo "The Docker build will COPY models/ into the image."
