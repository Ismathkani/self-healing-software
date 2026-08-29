import os, sys, json, random
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

# ── Make sure the model module is importable ──────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from model.stgt_model import SpatioTemporalGraphTransformer

# ── Hyper-parameters ──────────────────────────────────────────
SEQ_LEN     = 30        # sliding window length (seconds)
BATCH_SIZE  = 64
EPOCHS      = 40
LR          = 0.001
HIDDEN      = 64
LAYERS      = 2
DROPOUT     = 0.2
DEVICE      = 'cuda' if torch.cuda.is_available() else 'cpu'

DATA_PATH   = os.path.join(os.path.dirname(__file__), '..', 'data', 'telemetry_dataset.csv')
MODEL_PATH  = os.path.join(os.path.dirname(__file__), '..', 'model', 'best_model.pth')
SCALER_PATH = os.path.join(os.path.dirname(__file__), '..', 'model', 'scaler.json')


# ─────────────────────────────────────────────────────────────
# 1. DATASET GENERATION (if CSV doesn't exist)
# ─────────────────────────────────────────────────────────────
def generate_synthetic_dataset(n_rows: int = 5000) -> pd.DataFrame:
    np.random.seed(42)
    rows = []

    cpu_base = 25.0
    mem_base = 80.0   # MB

    for i in range(n_rows):
        t = pd.Timestamp('2024-01-01') + pd.Timedelta(seconds=i)

        # Normal fluctuation
        cpu = cpu_base + np.random.normal(0, 5)
        mem = mem_base + np.random.normal(0, 3)
        lat = 45 + np.random.normal(0, 10)
        err = 1 if random.random() < 0.05 else 0  # 5 % baseline error rate
        label = 0

        # ── Inject a failure signature every 300±100 rows ─────
        cycle = i % (300 + random.randint(-100, 100) or 300)
        if cycle == 0 and i > 60:
            # Failure event: label the NEXT row as 1
            # and ramp up metrics in the preceding 60 rows
            pass  # handled below via look-ahead

        # Look-ahead: are we 1–60 rows before a failure?
        # We mark failure rows every ~300 rows starting at row 120
        failure_rows = list(range(120, n_rows, 300))
        distance_to_failure = None
        for fr in failure_rows:
            d = fr - i
            if 0 <= d <= 60:
                distance_to_failure = d
                break
            if d == 0:
                label = 1

        if distance_to_failure is not None and distance_to_failure <= 60:
            # Ramp severity as we get closer to failure
            severity = 1 - (distance_to_failure / 60.0)  # 0 at 60s out, 1 at crash
            cpu += severity * np.random.uniform(30, 60)
            mem += severity * np.random.uniform(50, 150)
            lat += severity * np.random.uniform(100, 500)
            err = 1 if random.random() < (0.3 + severity * 0.5) else 0

        if i in failure_rows:
            label = 1
            cpu   = min(cpu_base + np.random.uniform(70, 95), 99.9)
            mem   = mem_base + np.random.uniform(200, 400)
            lat   = 45 + np.random.uniform(800, 2000)
            err   = 1

        rows.append({
            'timestamp':  t.isoformat(),
            'cpuPercent': round(max(min(cpu, 99.9), 0), 2),
            'heapUsedMB': round(max(mem, 10), 2),
            'latencyMs':  round(max(lat, 5), 2),
            'errorCount': int(err),
            'label':      label
        })

    df = pd.DataFrame(rows)
    df.to_csv(DATA_PATH, index=False)
    print(f"[Dataset] Generated {len(df)} rows → {DATA_PATH}")
    return df


# ─────────────────────────────────────────────────────────────
# 2. LOAD & PREPROCESS
# ─────────────────────────────────────────────────────────────
def load_data():
    if not os.path.exists(DATA_PATH):
        print("[Dataset] CSV not found — generating synthetic data...")
        generate_synthetic_dataset()

    df = pd.read_csv(DATA_PATH)
    print(f"[Dataset] Loaded {len(df)} rows from {DATA_PATH}")

    feature_cols = ['cpuPercent', 'heapUsedMB', 'latencyMs', 'errorCount']
    X_raw = df[feature_cols].values.astype(np.float32)
    y_raw = df['label'].values.astype(np.float32)

    # Normalise features
    scaler = StandardScaler()
    X_norm = scaler.fit_transform(X_raw)

    # Save scaler stats for inference
    scaler_data = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist()
    }
    with open(SCALER_PATH, 'w') as f:
        json.dump(scaler_data, f)

    return X_norm, y_raw, scaler


# ─────────────────────────────────────────────────────────────
# 3. SLIDING WINDOW SLICING
# ─────────────────────────────────────────────────────────────
def create_windows(X, y, seq_len=SEQ_LEN):
    """
    Converts flat arrays into [N, seq_len, features] windows.
    Each window's label = max(y[i : i+seq_len]) so that if ANY
    failure occurs in the window, the label is 1.
    """
    Xw, yw = [], []
    for i in range(len(X) - seq_len):
        Xw.append(X[i : i + seq_len])
        yw.append(max(y[i : i + seq_len]))   # 1 if failure anywhere in window

    return np.array(Xw), np.array(yw)


# ─────────────────────────────────────────────────────────────
# 4. TRAIN
# ─────────────────────────────────────────────────────────────
def train():
    print(f"[Train] Device: {DEVICE}")

    X_norm, y_raw, scaler = load_data()
    X_win, y_win = create_windows(X_norm, y_raw)

    # Train / val split
    X_train, X_val, y_train, y_val = train_test_split(
        X_win, y_win, test_size=0.2, random_state=42, stratify=y_win
    )

    # Convert to tensors
    X_train_t = torch.tensor(X_train, dtype=torch.float32)
    y_train_t = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
    X_val_t   = torch.tensor(X_val,   dtype=torch.float32)
    y_val_t   = torch.tensor(y_val,   dtype=torch.float32).unsqueeze(1)

    train_ds = TensorDataset(X_train_t, y_train_t)
    val_ds   = TensorDataset(X_val_t,   y_val_t)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False)

    # Model
    model   = SpatioTemporalGraphTransformer(
        input_size=4, hidden_size=HIDDEN,
        num_layers=LAYERS, dropout=DROPOUT, bidirectional=True
    ).to(DEVICE)

    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    best_val_loss = float('inf')

    print(f"[Train] Training set: {len(X_train)} | Validation set: {len(X_val)}")
    print(f"[Train] Positive labels — Train: {y_train.sum():.0f} | Val: {y_val.sum():.0f}")
    print("-" * 60)

    for epoch in range(1, EPOCHS + 1):
        # ── Training ──────────────────────────────────────
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0

        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()

            train_loss   += loss.item() * xb.size(0)
            preds_binary = (pred > 0.5).float()
            train_correct+= (preds_binary == yb).sum().item()
            train_total  += xb.size(0)

        train_loss /= train_total
        train_acc   = train_correct / train_total

        # ── Validation ────────────────────────────────────
        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0

        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(DEVICE), yb.to(DEVICE)
                pred   = model(xb)
                loss   = criterion(pred, yb)
                val_loss    += loss.item() * xb.size(0)
                preds_binary = (pred > 0.5).float()
                val_correct += (preds_binary == yb).sum().item()
                val_total   += xb.size(0)

        val_loss /= val_total
        val_acc   = val_correct / val_total
        scheduler.step(val_loss)

        print(f"Epoch {epoch:3d}/{EPOCHS} | "
              f"Train Loss: {train_loss:.4f} Acc: {train_acc:.3f} | "
              f"Val Loss:   {val_loss:.4f} Acc: {val_acc:.3f} | "
              f"LR: {optimizer.param_groups[0]['lr']:.6f}")

        # ── Save best ─────────────────────────────────────
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  → New best model saved (val_loss={val_loss:.4f})")

    print("=" * 60)
    print(f"[Train] DONE. Best val loss: {best_val_loss:.4f}")
    print(f"[Train] Model saved to: {MODEL_PATH.replace('best_model.pth', 'stgt_best.pth')}")


if __name__ == "__main__":
    train()
