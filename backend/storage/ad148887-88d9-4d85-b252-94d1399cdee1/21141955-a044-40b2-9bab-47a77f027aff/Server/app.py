import streamlit as st
import os
import joblib
import numpy as np
import pandas as pd     
import sqlite3          
from datetime import datetime

# PATH DEFINITIONS 
DB_PATH  = "healthfed_metrics.db"
LOG_PATH = "central_audit.log"

# DATA FETCHING HELPERS
def get_network_stats():
    """Calculates total historical rounds from SQLite."""
    if not os.path.exists(DB_PATH):
        return 0
    conn = sqlite3.connect(DB_PATH)
    # Count the total number of entries in the ledger
    df = pd.read_sql_query("SELECT COUNT(*) as count FROM training_metrics", conn)
    conn.close()
    return int(df['count'][0])

def get_all_logs():
    """Reads and reverses the log file so newest is on top."""
    if not os.path.exists(LOG_PATH):
        return ["No logs found. Start server.py."]
    with open(LOG_PATH, "r") as f:
        lines = f.readlines()
    return lines[::-1]  # Reverse list for 'Newest First'

# ANALYTICS DATA HELPER 
def get_analytics_data():
    if not os.path.exists(DB_PATH):
        return pd.DataFrame()
    conn = sqlite3.connect(DB_PATH)
    # Fetching the full history of the federated training
    df = pd.read_sql_query("SELECT * FROM training_metrics ORDER BY round_integer ASC", conn)
    conn.close()
    return df

# COLOR & THEME SETTINGS 
# Backgrounds
BG_COLOR = "#EBEEFA"          # Pure White
CARD_COLOR = "#F7F9FC"        # Slightly darker white/blue-grey for containers
BORDER_COLOR = "#D1D9E6"      # Soft grey for borders

# Medical Identity Colors
MED_RED = "#FF3B5C"           # Fed / High Risk
MED_GREEN = "#00C896"         # Health / Success
MED_BLUE = "#3B82F6"          # Network / Info
TEXT_COLOR = "#0D1B2A"        # Dark Navy (High contrast)

# PAGE CONFIGURATION
st.set_page_config(
    page_title="HealthFed · Unified Dashboard",
    page_icon="🫀",
    layout="wide",
    initial_sidebar_state="expanded"
)

# GLOBAL CSS (Forces Light Mode & Card Contrast)
st.markdown(f"""
<style>
    /* Force Light Mode Background */
    .stApp {{
        background-color: {BG_COLOR} !important;
    }}

    /* Top Right Branding */
    .brand-container {{
        position: absolute;
        top: -50px;
        right: 0;
        padding: 10px;
        font-family: sans-serif;
        font-size: 24px;
        font-weight: 800;
    }}
    .brand-health {{ color: {TEXT_COLOR}; }}
    .brand-fed {{ color: {MED_RED}; }}

    /* Custom Container (The "Card") */
    .medical-card {{
        background-color: {CARD_COLOR} !important;
        border: 1px solid {BORDER_COLOR};
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        color: {TEXT_COLOR} !important;
    }}

    /* Sidebar Styling */
    [data-testid="stSidebar"] {{
        background-color: {CARD_COLOR} !important;
        border-right: 1px solid {BORDER_COLOR};
    }}

    /* Force all text to be dark navy for readability */
    h1, h2, h3, p, span, label, .stMarkdown {{
        color: {TEXT_COLOR} !important;
    }}
</style>
""", unsafe_allow_html=True)

# TOP NAVIGATION & BRANDING
st.markdown(f"""
    <div class="brand-container">
        <span class="brand-health">Health</span><span class="brand-fed">Fed</span>
    </div>
""", unsafe_allow_html=True)

# MENU BAR (Sidebar Navigation)
with st.sidebar:
    st.markdown("### 🏥 System Menu")
    # This radio button acts as our page switcher
    menu_selection = st.radio(
        "Navigate to:",
        [
            "🌐 Network Overview", 
            "📊 Model Analytics", 
            "🫀 Patient Diagnostic"
        ],
        index=0  # Default is Network Overview
    )
    
    st.write("---")
    st.caption("HealthFed Decentralized Framework made by Nitesh Lohar")

# PAGE ROUTING LOGIC
if menu_selection == "🌐 Network Overview":
    st.title("🌐 Network Overview")
    st.write("Current Page: **Hospital & Network Status**")
    # 1. KPI CARDS (Same as before, consistent UI)
    num_rounds = get_network_stats()
    col_kpi1, col_kpi2, col_kpi3 = st.columns(3)
    
    with col_kpi1:
        st.markdown(f'<div class="medical-card" style="border-left: 5px solid {MED_BLUE};"><p class="lbl">ACTIVE NODES</p><h2>2 Hospitals</h2></div>', unsafe_allow_html=True)
    with col_kpi2:
        st.markdown(f"""
            <div class="medical-card" style="border-left: 5px solid {MED_GREEN};">
                <p class="lbl">TOTAL TRAINING ROUNDS</p>
                <h2 style="margin:0;">{num_rounds} Rounds</h2>
            </div>
        """, unsafe_allow_html=True)
    with col_kpi3:
        st.markdown(f'<div class="medical-card" style="border-left: 5px solid {MED_RED};"><p class="lbl">PRIVACY STATUS</p><h2>Zero Data Transfer</h2></div>', unsafe_allow_html=True)

    st.write("---")

    st.subheader("🏥 Connected Nodes")
    st.info("**Hospital A** · Port 8080 · Status: Online")
    st.info("**Hospital B** · Port 8080 · Status: Online")

    st.write("---")

    # 2. LOG SECTION (REFINED)
    # Using columns to align the header and the refresh button
    header_col, btn_col = st.columns([4, 1])
    with header_col:
        st.subheader("📜 Central Audit Logs")
    with btn_col:
        if st.button("↻ Refresh Logs"):
            st.rerun()

    # --- THE LOG BOX ---
    logs = get_all_logs()
    # Create the HTML for each line with better spacing
    log_html = "".join([
        f"<div style='margin-bottom:14px; border-bottom:1px solid #E2E8F0; padding-bottom:6px; font-family:monospace;'>"
        f"{line}</div>" for line in logs
    ])

    # The main container for ALL records
    st.markdown(f"""
        <div style="
            background-color: #F8FAFC; 
            border: 2px solid {MED_BLUE}; 
            border-radius: 15px; 
            padding: 25px; 
            height: 450px; 
            overflow-y: auto; 
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        ">
            {log_html}
        </div>
    """, unsafe_allow_html=True)

elif menu_selection == "📊 Model Analytics":
    st.title("📊 Model Analytics")
    st.write("Current Page: **Training Performance**")
    # We will add the SQLite-fetched graphs here next.
    df = get_analytics_data()

    if df.empty:
        st.warning("⚠️ No training data found. Please run a federated session to populate the dashboard.")
    else:
        # --- ROW 1: 4 KPI CARDS (Horizontal) ---
        latest = df.iloc[-1] # Get the most recent round results
        
        c1, c2, c3, c4 = st.columns(4)
        
        with c1:
            st.markdown(f"""<div class="medical-card" style="border-top: 5px solid {MED_GREEN};">
                <p class="lbl">GLOBAL ACCURACY</p><h2>{latest['accuracy']*100:.2f}%</h2></div>""", unsafe_allow_html=True)
        with c2:
            st.markdown(f"""<div class="medical-card" style="border-top: 5px solid {MED_BLUE};">
                <p class="lbl">PRECISION</p><h2>{latest['precision']*100:.2f}%</h2></div>""", unsafe_allow_html=True)
        with c3:
            st.markdown(f"""<div class="medical-card" style="border-top: 5px solid {MED_RED};">
                <p class="lbl">F1 SCORE</p><h2>{latest['f1_score']*100:.2f}%</h2></div>""", unsafe_allow_html=True)
        with c4:
            st.markdown(f"""<div class="medical-card" style="border-top: 5px solid {TEXT_COLOR};">
                <p class="lbl">FINAL LOSS</p><h2>{latest['loss']:.4f}</h2></div>""", unsafe_allow_html=True)

        st.write("---")

        # --- ROW 2 & 3: 4 GRAPHS (2 per row) ---
        # Round integer on X-axis for all
        plot_df = df.set_index('id')

        row1_col1, row1_col2 = st.columns(2)
        with row1_col1:
            st.subheader("📈 Accuracy Trend")
            st.line_chart(plot_df['accuracy'], color=MED_GREEN)
        
        with row1_col2:
            st.subheader("🎯 Precision Trend")
            st.line_chart(plot_df['precision'], color=MED_BLUE)

        row2_col1, row2_col2 = st.columns(2)
        with row2_col1:
            st.subheader("🧬 F1 Score Trend")
            st.line_chart(plot_df['f1_score'], color=MED_RED)
        
        with row2_col2:
            st.subheader("📉 Loss Convergence")
            st.area_chart(plot_df['loss'])

        # --- ROW 4: CONTINUOUS DATA TABLE ---
        st.write("---")
        st.subheader("📋 Continuous Training Ledger")
        
        # We rename 'id' to 'Session Entry' to make it look professional
        display_df = df.rename(columns={
            'id': 'Entry #',
            'round_integer': 'Round',
            'accuracy': 'Accuracy',
            'precision': 'Precision',
            'f1_score': 'F1 Score',
            'loss': 'Loss',
            'timestamp': 'Timestamp'
        })

        # Displaying the raw data for verification
        # 'Entry #' will now show 1, 2, 3... 10, 11... infinitely
        st.dataframe(
            display_df[['Entry #', 'Round', 'Accuracy', 'Precision', 'F1 Score', 'Loss', 'Timestamp']], 
            use_container_width=True,
            hide_index=True
        )
        
        st.caption("📝 Note: The 'Entry #' represents the global sequence of training across all server sessions.")

elif menu_selection == "🫀 Patient Diagnostic":
    st.title("🫀 Patient Diagnostic")
    st.write("Current Page: **Risk Assessment**")
    # We will add the input form and global model inference here next.
    # 1. MODEL CHECK
    MODEL_PATH = "models/global_model.joblib"
    
    if not os.path.exists(MODEL_PATH):
        st.error("❌ **Global Model Not Found.** Run a training session first.")
    else:
        # Load the Neural Network Brain
        payload = joblib.load(MODEL_PATH)
        st.success(f"✅ **Neural Network Model Active** (Last Sync: {payload['saved_at']})")
        st.write("---")

        st.subheader("📋 Patient Clinical Metrics")
        with st.form("diag_form"):
            col1, col2, col3 = st.columns(3)
            with col1:
                age = st.number_input("Age (Years)", 28, 77, 45)
                sex = st.selectbox("Biological Sex", options=[(1, "Male"), (0, "Female")])[0]
                cp = st.selectbox("Chest Pain Type (CP)", options=[(1, "Typical"), (2, "Atypical"), (3, "Non-anginal"), (4, "Asymptomatic")])[0]
                trestbps = st.number_input("Resting BP (mm Hg)", 80, 201, 120)
            with col2:
                chol = st.number_input("Cholesterol (mg/dl)", 85, 603, 200)
                fbs = st.selectbox("Fasting Sugar > 120", options=[(0, "No"), (1, "Yes")])[0]
                restecg = st.selectbox("Resting ECG", options=[(0, "Normal"), (1, "Abnormal"), (2, "Hypertrophy")])[0]
                thalach = st.number_input("Max Heart Rate", 60, 203, 150)
            with col3:
                exang = st.selectbox("Exercise Angina", options=[(0, "No"), (1, "Yes")])[0]
                oldpeak = st.number_input("ST Depression", -2.6, 6.2, 1.0, format="%.1f")
                slope = st.selectbox("ST Slope", options=[(1, "Upsloping"), (2, "Flat"), (3, "Downsloping")])[0]
                ca = st.number_input("Major Vessels (0-3)", 0, 3, 0)
                thal = st.selectbox("Thallium Scan", options=[(3, "Normal"), (6, "Fixed"), (7, "Reversible")])[0]

            submit = st.form_submit_button("🔍 Run Neural Analysis")

        if submit:
            from sklearn.neural_network import MLPClassifier
            
            # 1. RECONSTRUCT ARCHITECTURE
            model = MLPClassifier(hidden_layer_sizes=(64, 32), activation='relu', random_state=42)
            model.fit(np.zeros((2, 13)), np.array([0, 1])) 
            
            # Overwrite weights
            n_layers = len(model.coefs_)
            model.coefs_ = payload['weights'][:n_layers]
            model.intercepts_ = payload['weights'][n_layers:]

            # 2. MANUAL NORMALIZATION (Vital for Neural Networks)
            # We scale the values based on the ranges in your 'fixed_heart_data_1.docx'
            def scale(val, v_min, v_max):
                return (val - v_min) / (v_max - v_min + 1e-5)

            # Scaling continuous variables to [0, 1] range
            s_age = scale(age, 28, 77)
            s_bps = scale(trestbps, 80, 201)
            s_chol = scale(chol, 85, 603)
            s_hr = scale(thalach, 60, 203)
            s_pk = scale(oldpeak, -2.6, 6.2)

            # Prepared Feature Vector
            features = np.array([[s_age, sex, cp, s_bps, s_chol, fbs, restecg, s_hr, exang, s_pk, slope, ca, thal]])

            # 3. PREDICT
            prediction = model.predict(features)[0]
            prob_array = model.predict_proba(features)[0]
            
            # Use the actual probability for class 1
            prob = prob_array[1]

            st.write("---")
            if prob > 0.5:
                st.markdown(f"""<div style="background-color:#ffe6e6; padding:20px; border-radius:10px; border-left: 8px solid #FF4B4B;">
                    <h2 style="color:#FF4B4B; margin:0;">🚨 High Risk Profile</h2>
                    <p style="color:#333; font-size:18px;">Probability: <b>{prob*100:.1f}%</b></p></div>""", unsafe_allow_html=True)
            else:
                st.markdown(f"""<div style="background-color:#e6fffa; padding:20px; border-radius:10px; border-left: 8px solid #00C896;">
                    <h2 style="color:#00C896; margin:0;">✅ Low Risk Profile</h2>
                    <p style="color:#333; font-size:18px;">Probability: <b>{prob*100:.1f}%</b></p></div>""", unsafe_allow_html=True)
