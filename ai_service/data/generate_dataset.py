import os
import random
import numpy as np
import pandas as pd

def generate_dataset(n_rows: int = 5000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    random.seed(seed)

    # ── Determine failure-event positions ────────────────────
    failure_positions = []
    pos = 200  # first failure at row 200 (enough history to fill a window)
    while pos < n_rows:
        failure_positions.append(pos)
        pos += random.randint(220, 380)  # spacing between failures

    failure_set = set(failure_positions)
    print(f"[Gen] Injecting {len(failure_positions)} failure events at rows: {failure_positions[:10]}...")

    # ── Pre-compute labels: label[i] = 1 if any failure in [i, i+60) ─
    labels = np.zeros(n_rows, dtype=int)
    for fp in failure_positions:
        for i in range(max(0, fp - 60), fp + 1):
            labels[i] = 1

    # ── Generate row-by-row ──────────────────────────────────
    rows = []
    base_time = pd.Timestamp('2024-06-15 08:00:00')

    # Baseline levels (normal operation)
    CPU_BASE = 22.0
    MEM_BASE = 75.0
    LAT_BASE = 42.0

    for i in range(n_rows):
        timestamp = (base_time + pd.Timedelta(seconds=i)).isoformat()

        # Normal jitter
        cpu = CPU_BASE + np.random.normal(0, 4.0)
        mem = MEM_BASE + np.random.normal(0, 2.5)
        lat = LAT_BASE + np.random.normal(0, 8.0)
        err = 1 if random.random() < 0.04 else 0  # 4 % base error rate

        # ── Is this row in a pre-failure ramp? ─────────────
        for fp in failure_positions:
            dist = fp - i  # seconds until failure
            if dist < 0:
                continue
            # Randomize ramp length for faster training (15s to 60s)
            ramp_len = random.randint(15, 60)
            if dist <= ramp_len:
                severity = 1.0 - (dist / float(ramp_len))
                
                # CPU ramp
                cpu += severity * np.random.uniform(25, 65)

                # Memory leak ramp (progressive)
                mem += severity * np.random.uniform(40, 180)

                # Latency ramp
                lat += severity * np.random.uniform(80, 450)

                # Error probability increases
                err = 1 if random.random() < (0.15 + severity * 0.6) else err
                break  # only apply closest failure

        # ── At the exact failure row ───────────────────────
        if i in failure_set:
            cpu = min(CPU_BASE + np.random.uniform(60, 95), 99.9)
            mem = MEM_BASE + np.random.uniform(180, 380)
            lat = LAT_BASE + np.random.uniform(700, 1800)
            err = 1

        # Clamp values to realistic ranges
        cpu = round(max(min(cpu, 99.9), 0.1), 2)
        mem = round(max(mem, 12.0), 2)
        lat = round(max(lat, 8.0), 2)

        rows.append({
            'timestamp':  timestamp,
            'cpuPercent': cpu,
            'heapUsedMB': mem,
            'latencyMs':  lat,
            'errorCount': err,
            'label':      int(labels[i])
        })

    df = pd.DataFrame(rows)
    return df


if __name__ == "__main__":
    out_path = os.path.join(os.path.dirname(__file__), 'telemetry_dataset.csv')
    df = generate_dataset(n_rows=5000)
    df.to_csv(out_path, index=False)

    print(f"[Gen] Dataset written to {out_path}")
    print(f"[Gen] Total rows      : {len(df)}")
    print(f"[Gen] Positive labels : {df['label'].sum()} ({df['label'].mean()*100:.1f}%)")
    print(f"[Gen] Negative labels : {(1-df['label']).sum()}")
    print()
    print(df.describe())
    print()
    print("First 5 rows:")
    print(df.head())
    print()
    print("Sample failure window (rows around first failure):")
    # Find first failure
    first_f = df[df['label']==1].index[0]
    print(df.iloc[max(0,first_f-5):first_f+3])
