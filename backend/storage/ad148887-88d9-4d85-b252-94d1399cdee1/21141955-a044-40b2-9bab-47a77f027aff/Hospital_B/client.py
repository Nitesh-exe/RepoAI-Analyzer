"""
Client
"""

import os
import argparse
import warnings
from datetime import datetime
from typing import List, Tuple, Dict

import numpy as np
import pandas as pd
import flwr as fl

from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, log_loss, precision_score, f1_score

warnings.filterwarnings("ignore")

# --- Clinical Constants ---
FEATURE_COLUMNS = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]
TARGET_COLUMN = "target"

class HealthFedClient(fl.client.NumPyClient):
    def __init__(self, data_path: str, server_address: str):
        self.data_path = data_path
        self.hospital_id = os.path.splitext(os.path.basename(data_path))[0]
        
        # Initialize Neural Network (MLP)
        # Hidden layers: 64 neurons then 32 neurons
        self.model = MLPClassifier(
            hidden_layer_sizes=(64, 32),
            activation='relu',
            solver='adam',
            max_iter=10,  # We train 10 epoch per federated round
            warm_start=True,
            random_state=42
        )
        
        self.X_train, self.X_test, self.y_train, self.y_test = self._load_data()
        self._log(f"NN Client Initialized. Local records: {len(self.X_train) + len(self.X_test)}")

    def _log(self, msg):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] | {self.hospital_id} | {msg}")

    def _load_data(self):
        df = pd.read_csv(self.data_path)
        X = df[FEATURE_COLUMNS].values
        y = df[TARGET_COLUMN].values
        return train_test_split(X, y, test_size=0.2, random_state=42)

    def get_parameters(self, config):
        """Extracts all weights and biases from the Neural Network."""
        if not hasattr(self.model, "coefs_"):
            # Initial dummy fit to initialize weight matrices
            self.model.fit(self.X_train, self.y_train)
        
        # Flower expects a list of NumPy arrays
        params = self.model.coefs_ + self.model.intercepts_
        return params

    def set_parameters(self, parameters):
        """Sets the weights and biases received from the Global Server."""
        n_layers = len(self.model.coefs_)
        self.model.coefs_ = parameters[:n_layers]
        self.model.intercepts_ = parameters[n_layers:]

    def fit(self, parameters, config):
        """Updates local NN with global weights and performs 1 epoch of training."""
        if not hasattr(self.model, "coefs_"):
            self.model.fit(self.X_train, self.y_train)

        if len(parameters) > 0:
            self.set_parameters(parameters)
        
        # Train for 1 iteration (Round)
        self.model.fit(self.X_train, self.y_train)
        
        acc = accuracy_score(self.y_train, self.model.predict(self.X_train))
        self._log(f"Fit Complete. Local Accuracy: {acc:.4f}")
        
        return self.get_parameters(config={}), len(self.X_train), {"accuracy": float(acc)}

    def evaluate(self, parameters, config):
        """Tests the Global Neural Network on local hospital data."""
        self.set_parameters(parameters)
        
        y_pred = self.model.predict(self.X_test)
        y_proba = self.model.predict_proba(self.X_test)
        
        acc = accuracy_score(self.y_test, y_pred)
        pre = precision_score(self.y_test, y_pred, zero_division=0)
        f1  = f1_score(self.y_test, y_pred, zero_division=0)
        loss = log_loss(self.y_test, y_proba)
        
        self._log(f"Evaluation: Accuracy={acc:.4f}, Precision={pre:.4f}, F1={f1:.4f}")
        
        return float(loss), len(self.X_test), {
            "accuracy": float(acc),
            "precision": float(pre),
            "f1_score": float(f1)
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, required=True)
    parser.add_argument("--server", type=str, default="localhost:8080")
    args = parser.parse_args()

    fl.client.start_numpy_client(
        server_address=args.server, 
        client=HealthFedClient(args.data, args.server)
    )
