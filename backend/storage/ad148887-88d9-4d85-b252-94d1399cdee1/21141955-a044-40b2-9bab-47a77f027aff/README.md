# HealthFed: Federated Learning System
### made by Nitesh Lohar

This project implements a decentralized machine learning model using the Flower framework to train on hospital data without compromising privacy.

## 1. Creating Virtual Environment
It is highly recommended to use a virtual environment to avoid version conflicts between libraries.

Windows:  
```
python -m venv venv
.\venv\Scripts\activate
```

Linux/macOS:  
```
python3 -m venv venv
source venv/bin/activate
```

## 2. Installation of Libraries
Once your environment is active, run this to install the libraries mentioned in "requirements.txt".
```
pip install -r requirements.txt
```

## 3. Running the Server
The central server must be started first to coordinate the training rounds.

Windows:
```
python server.py
```

Linux/macOS:
```
python3 server.
```

## 4. Running the Clients
Open new terminal windows for each client. Each client represents a different data source (e.g., different hospitals).

Windows:  
Terminal 2
```
python client.py --data data\hospital_a.csv --server localhost:8080
```

Terminal 3
```
python client.py --data data\hospital_b.csv --server localhost:8080
```

Linux/macOS:  
Terminal 2
```
python3 client.py --data data/hospital_a.csv --server localhost:8080
```

Terminal 3
```
python3 client.py --data data/hospital_b.csv --server localhost:8080
```

## 5. Launching the Dashboard
To visualize the training progress and metrics, run the Streamlit application.
```
streamlit run app.py
```
