"""
Server
"""
import os
import joblib
import sqlite3
import numpy as np
from datetime import datetime
from typing import List, Tuple, Optional, Dict

import flwr as fl
from flwr.common import Metrics, Parameters, Scalar
from flwr.server.strategy import FedAvg

class HealthFedServer:
    LOG_FILE = "central_audit.log"
    MODEL_DIR = "models"
    MODEL_FILE = "global_model.joblib"
    DB_FILE = "healthfed_metrics.db"

    def __init__(self, min_clients: int = 2, num_rounds: int = 10):
        self.min_clients = min_clients
        self.num_rounds = num_rounds
        os.makedirs(self.MODEL_DIR, exist_ok=True)
        self._init_database()
        self._log_event(f"HealthFedServer Initialized. Mode: Neural Network (MLP)")

    def _init_database(self):
        conn = sqlite3.connect(self.DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS training_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_integer INTEGER,
                accuracy REAL,
                precision REAL,
                f1_score REAL,
                loss REAL,
                timestamp DATETIME
            )
        ''')
        conn.commit()
        conn.close()

    def _save_round_metrics(self, round_idx: int, metrics: Dict[str, Scalar]):
        try:
            conn = sqlite3.connect(self.DB_FILE)
            cursor = conn.cursor()
            acc = metrics.get("accuracy", 0.0)
            pre = metrics.get("precision", 0.0)
            f1  = metrics.get("f1_score", 0.0)
            loss = metrics.get("loss", 0.0)
            
            cursor.execute('''
                INSERT INTO training_metrics 
                (round_integer, accuracy, precision, f1_score, loss, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (int(round_idx), float(acc), float(pre), float(f1), float(loss), datetime.now().isoformat()))
            
            conn.commit()
            conn.close()
            self._log_event(f"Metrics stored for Round {round_idx}.")
        except Exception as e:
            self._log_event(f"Database Error: {e}")

    def _log_event(self, message: str) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] | SERVER_EVENT | {message}\n"
        with open(self.LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry)
        print(log_entry, end="")

    def _save_global_model(self, parameters: Parameters) -> None:
        """Saves the averaged weights and biases of the Neural Network."""
        save_path = os.path.join(self.MODEL_DIR, self.MODEL_FILE)
        try:
            # Convert Flower parameters back to NumPy arrays (Weights/Biases)
            param_arrays = fl.common.parameters_to_ndarrays(parameters)
            payload = {
                "weights": param_arrays, 
                "saved_at": datetime.now().isoformat(),
                "model_type": "MLPClassifier"
            }
            joblib.dump(payload, save_path)
            self._log_event(f"Global Neural Network Model Saved → {save_path}")
        except Exception as exc:
            self._log_event(f"Model Save Failed: {exc}")

    def weighted_average(self, metrics: List[Tuple[int, Metrics]]) -> Metrics:
        examples = [m[0] for m in metrics]
        total_examples = sum(examples)
        if total_examples == 0: return {}

        acc = sum([m[1].get("accuracy", 0.0) * m[0] for m in metrics]) / total_examples
        pre = sum([m[1].get("precision", 0.0) * m[0] for m in metrics]) / total_examples
        f1  = sum([m[1].get("f1_score", 0.0) * m[0] for m in metrics]) / total_examples
        
        return {"accuracy": acc, "precision": pre, "f1_score": f1}

    def _build_strategy(self) -> FedAvg:
        server_ref = self

        class AuditedFedAvg(FedAvg):
            def aggregate_evaluate(self, server_round, results, failures):
                agg_loss, agg_metrics = super().aggregate_evaluate(server_round, results, failures)
                if agg_metrics:
                    agg_metrics["loss"] = agg_loss if agg_loss else 0.0
                    server_ref._save_round_metrics(server_round, agg_metrics)
                return agg_loss, agg_metrics

            def aggregate_fit(self, server_round, results, failures):
                server_ref._log_event(f"Round {server_round} | Aggregating NN weights from {len(results)} nodes.")
                aggregated_params, metrics = super().aggregate_fit(server_round, results, failures)
                
                if aggregated_params is not None and server_round == server_ref.num_rounds:
                    server_ref._save_global_model(aggregated_params)
                return aggregated_params, metrics

        return AuditedFedAvg(
            min_fit_clients=self.min_clients,
            min_evaluate_clients=self.min_clients,
            min_available_clients=self.min_clients,
            evaluate_metrics_aggregation_fn=self.weighted_average, 
        )

    def start(self) -> None:
        address = "0.0.0.0:8080"
        strategy = self._build_strategy()
        self._log_event(f"Flower server starting on {address}...")
        fl.server.start_server(
            server_address=address,
            config=fl.server.ServerConfig(num_rounds=self.num_rounds),
            strategy=strategy,
        )

if __name__ == "__main__":
    server = HealthFedServer(min_clients=2, num_rounds=10)
    server.start()
