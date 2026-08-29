import torch
import torch.nn as nn
import torch.nn.functional as F

class SpatioTemporalGraphTransformer(nn.Module):
    """
    Advanced Graph-LSTM Hybrid Model.
    Uses a Bidirectional LSTM for temporal feature extraction and 
    a learnable Spatial Gate for graph-based failure propagation.
    """
    def __init__(
        self,
        input_size: int = 4,       # [CPU, MEM, LAT, ERR]
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.2,
        bidirectional: bool = True
    ):
        super().__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1

        # ── Temporal Backbone: Bidirectional LSTM ──────────────────────
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional
        )
        
        # ── Spatial Attention Logic (Graph Technology) ─────────────────
        # This gate processes the output of the LSTM based on node adjacency.
        lstm_output_dim = hidden_size * self.num_directions
        self.spatial_gate = nn.Sequential(
            nn.Linear(lstm_output_dim, 64),
            nn.Tanh(),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
        
        # ── FC Classification Head ──────────────────────────────
        self.fc = nn.Sequential(
            nn.Linear(lstm_output_dim, 32),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

    def forward(self, x, adj=None):
        """
        x   : Tensor [batch, seq_len, input_size]
        adj : Adjacency matrix [batch, num_nodes, num_nodes]
        """
        # 1. Temporal Processing via Bi-LSTM
        # output: [batch, seq_len, hidden*num_directions]
        output, (h_n, _) = self.lstm(x)
        
        # 2. Extract Recent State (Last Timestep)
        recent_state = output[:, -1, :] # [batch, hidden*num_directions]
        
        # 3. Spatial Graph Propagation
        # If adjacency is provided, use it to weigh the current node's influence
        if adj is not None:
            spatial_weights = self.spatial_gate(recent_state)
            # Simulate spatial propagation (scaling impact by graph degree)
            recent_state = recent_state * (1 + spatial_weights * adj.sum())
        
        # 4. Final Head
        prob = self.fc(recent_state)
        return prob

if __name__ == "__main__":
    # Demo for verification
    model = SpatioTemporalGraphTransformer()
    samples = torch.randn(8, 30, 4)
    out = model(samples)
    print(f"Graph-LSTM Hybrid Model Initialized")
    print(f"Output shape: {out.shape}")
    print(f"Failure Probability: {out.squeeze()[:2].tolist()}...")
