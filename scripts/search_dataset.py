
import pandas as pd
import os
import sys

# Define path to the dataset relative to this script
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'ai_service', 'data', 'telemetry_dataset.csv')

def search_dataset(query_type, value):
    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset not found at {DATA_PATH}")
        return

    df = pd.read_csv(DATA_PATH)
    
    if query_type == "cpu":
        # Search for high CPU usage
        result = df[df['cpuPercent'] > float(value)]
    elif query_type == "memory":
        # Search for high Memory usage
        result = df[df['heapUsedMB'] > float(value)]
    elif query_type == "failure":
        # Search for failure labels (1)
        result = df[df['label'] == 1]
    elif query_type == "timestamp":
        # Search for a specific date/time
        result = df[df['timestamp'].str.contains(str(value))]
    else:
        print("Invalid query type. Use: cpu, memory, failure, or timestamp")
        return

    if result.empty:
        print("No results found for your search.")
    else:
        print(f"Found {len(result)} matches:")
        print(result.head(20)) # Show top 20 results

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python search_dataset.py [cpu|memory|failure|timestamp] [value]")
        print("Example: python search_dataset.py cpu 90")
    else:
        search_dataset(sys.argv[1], sys.argv[2])
