"""
============================================================
AI SERVICE VALIDATION TEST
ai_service/tests/test_inference.py
============================================================
Run:
    cd ai_service
    python tests/test_inference.py

Tests:
  1. Model architecture instantiation
  2. Forward pass shape correctness
  3. Output range [0, 1]
  4. Scaler loading
  5. Preprocessing pipeline end-to-end
  6. FastAPI endpoint smoke test (if server is running)
============================================================
"""

import sys, os, json, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import numpy as np
import torch

passed = 0
failed = 0

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓ {name}")
        passed += 1
    else:
        print(f"  ✗ {name} — {detail}")
        failed += 1

print("=" * 55)
print("  Self-Heal AI Service — Validation Tests")
print("=" * 55)

# ── Test 1: Model instantiation ────────────────────────────
print("\n[1] Model Architecture")
from model.stgt_model import SpatioTemporalGraphTransformer

model = SpatioTemporalGraphTransformer(input_size=4, hidden_size=64, num_layers=2, bidirectional=True)
test("Model instantiates without error", model is not None)
test("Model is nn.Module", isinstance(model, torch.nn.Module))

param_count = sum(p.numel() for p in model.parameters())
test(f"Parameter count > 0 ({param_count:,} params)", param_count > 0)

# ── Test 2: Forward pass ───────────────────────────────────
print("\n[2] Forward Pass")
dummy_input = torch.randn(4, 30, 4)  # batch=4, seq=30, features=4
output = model(dummy_input)
test("Output shape is [4, 1]", output.shape == (4, 1), f"got {output.shape}")
test("Output values in [0, 1]", (output >= 0).all().item() and (output <= 1).all().item())

# ── Test 3: Single sample ─────────────────────────────────
print("\n[3] Single Sample Inference")
single = torch.randn(1, 30, 4)
with torch.no_grad():
    pred = model(single)
test("Single sample output is scalar-like", pred.shape == (1, 1))
prob = pred.item()
test(f"Probability value is float ({prob:.4f})", isinstance(prob, float))

# ── Test 4: Scaler ─────────────────────────────────────────
print("\n[4] Scaler Loading")
scaler_path = os.path.join(os.path.dirname(__file__), '..', 'model', 'scaler.json')
if os.path.exists(scaler_path):
    with open(scaler_path) as f:
        scaler_data = json.load(f)
    test("Scaler file loads as JSON", isinstance(scaler_data, dict))
    test("Has 'mean' key (length 4)", len(scaler_data.get('mean', [])) == 4)
    test("Has 'scale' key (length 4)", len(scaler_data.get('scale', [])) == 4)
else:
    print("  ⚠ Scaler not found — run training first")
    test("Scaler file exists", False, f"not found at {scaler_path}")

# ── Test 5: Preprocessing pipeline ────────────────────────
print("\n[5] Preprocessing Pipeline")
# Simulate what app.py does
mean  = np.array([25.0, 80.0, 45.0, 0.1])
scale = np.array([10.0, 30.0, 50.0, 0.3])

raw_samples = np.array([
    [30.0, 90.0, 60.0, 0],
    [35.0, 95.0, 70.0, 1],
    [40.0, 100.0, 80.0, 1],
], dtype=np.float32)

# Pad to 30 rows
padded = np.zeros((30, 4), dtype=np.float32)
padded[-3:] = raw_samples
normalised = (padded - mean) / scale
tensor_in  = torch.tensor(normalised, dtype=torch.float32).unsqueeze(0)

test("Preprocessed tensor shape is [1, 30, 4]", tensor_in.shape == (1, 30, 4))
test("No NaN values", not torch.isnan(tensor_in).any().item())
test("No Inf values", not torch.isinf(tensor_in).any().item())

with torch.no_grad():
    pred_out = model(tensor_in)
test(f"Prediction on preprocessed input: {pred_out.item():.4f}", 0 <= pred_out.item() <= 1)

# ── Test 6: FastAPI smoke test (optional) ─────────────────
print("\n[6] FastAPI Endpoint (optional — requires running server)")
try:
    import http.client
    conn = http.client.HTTPConnection("localhost", 5000, timeout=3)
    conn.request("GET", "/health")
    resp = conn.getresponse()
    data = json.loads(resp.read())
    test("FastAPI /health responds", resp.status == 200)
    test("Model loaded in server", data.get("model_loaded", False))
    conn.close()

    # Test /predict
    samples = [{"cpuPercent": 50+i*3, "heapUsedMB": 100+i*10, "latencyMs": 80+i*20, "errorCount": 1 if i>2 else 0} for i in range(30)]
    conn = http.client.HTTPConnection("localhost", 5000, timeout=5)
    conn.request("POST", "/predict", json.dumps({"samples": samples}), {"Content-Type": "application/json"})
    resp = conn.getresponse()
    pred_data = json.loads(resp.read())
    test("POST /predict responds 200", resp.status == 200)
    test("Has failureProbability", "failureProbability" in pred_data)
    test(f"Failure prob: {pred_data.get('failureProbability', 'N/A')}", True)
    conn.close()
except Exception as e:
    print(f"  ⚠ FastAPI server not running ({e}) — skipping live tests")

# ── Summary ─────────────────────────────────────────────────
print("\n" + "=" * 55)
print(f"  Results: {passed} passed, {failed} failed, {passed+failed} total")
print("=" * 55)

if failed > 0:
    sys.exit(1)
