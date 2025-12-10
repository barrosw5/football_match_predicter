from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import requests
import pandas as pd
import numpy as np
from scipy.stats import poisson
import traceback

app = Flask(__name__)
CORS(app)

API_KEY = "81f8d50f4cac1f4ac373794f18440676" 

LEAGUE_MAP = {
    39: 'E0', 78: 'D1', 140: 'SP1', 61: 'F1', 135: 'I1',
    40: 'E1', 79: 'D2', 141: 'SP2', 62: 'F2', 136: 'I2',
    94: 'P1', 88: 'N1', 144: 'B1', 203: 'T1', 197: 'G1', 179: 'SC0',
    2: 'CL'
}

# --- CARREGAMENTO ---
model_path = os.path.join(os.path.dirname(__file__), 'football_brain.pkl')

model_multi = None
xgb_goals_h = None
df_ready = pd.DataFrame()

print(f"\n🔄 A INICIAR SERVIDOR...")
if os.path.exists(model_path):
    try:
        artifacts = joblib.load(model_path)
        model_multi = artifacts.get('model_multi')
        model_shield = artifacts.get('model_shield')
        xgb_goals_h = artifacts.get('xgb_goals_h') or artifacts.get('model_goals_h')
        xgb_goals_a = artifacts.get('xgb_goals_a') or artifacts.get('model_goals_a')
        le_div = artifacts.get('le_div')
        features = artifacts.get('features')
        current_elos = artifacts.get('current_elos', {})
        df_ready = artifacts.get('df_ready', pd.DataFrame())
        print("✅ MODELOS CARREGADOS!")
    except Exception as e:
        print(f"❌ ERRO CRÍTICO: {e}")
else:
    print(f"❌ Ficheiro não encontrado: {model_path}")


@app.route('/api/fixtures', methods=['POST'])
def get_fixtures():
    try:
        data = request.get_json()
        url = "https://v3.football.api-sports.io/fixtures"
        params = {'date': data.get('date'), 'status': 'NS'}
        headers = {'x-rapidapi-key': API_KEY, 'x-rapidapi-host': "v3.football.api-sports.io"}

        response = requests.get(url, headers=headers, params=params)
        fixtures_data = response.json().get('response', [])
        supported_matches = []

        for f in fixtures_data:
            lid = f['league']['id']
            if lid in LEAGUE_MAP:
                supported_matches.append({
                    'home_team': f['teams']['home']['name'],
                    'away_team': f['teams']['away']['name'],
                    'division': LEAGUE_MAP[lid],
                    'league_name': f['league']['name'], 
                    'country': f['league']['country'],
                    'match_time': f['fixture']['date'].split('T')[1][:5],
                    'homeTeam': f['teams']['home']['name'],
                    'awayTeam': f['teams']['away']['name']
                })
        
        supported_matches.sort(key=lambda x: (x['league_name'], x['match_time']))
        return jsonify(supported_matches)

    except Exception as e:
        print(f"❌ Erro API: {e}")
        return jsonify([])

@app.route('/api/predict', methods=['POST'])
def predict():
    global model_multi, xgb_goals_h, xgb_goals_a, df_ready
    
    try:
        if model_multi is None: return jsonify({"error": "Modelos offline"}), 500
        data = request.get_json()
        
        # 1. Dados Básicos
        home, away = data.get('home_team'), data.get('away_team')
        div = data.get('division', 'E0')
        date_str = data.get('date')
        
        # 2. Features
        input_data = {}
        for f in features: input_data[f] = df_ready[f].mean() if not df_ready.empty and f in df_ready else 0
        
        match_date = pd.to_datetime(date_str)
        past = df_ready[df_ready['Date'] < match_date] if not df_ready.empty else pd.DataFrame()
        if not past.empty:
            h_elo = current_elos.get(home, 1500)
            a_elo = current_elos.get(away, 1500)
            input_data['HomeElo'] = h_elo; input_data['AwayElo'] = a_elo
            input_data['EloDiff'] = h_elo - a_elo

        # Odds
        try:
            odd_h = float(data.get('odd_h', 0))
            odd_d = float(data.get('odd_d', 0))
            odd_a = float(data.get('odd_a', 0))
            odd_1x = float(data.get('odd_1x')) if data.get('odd_1x') else None
            odd_12 = float(data.get('odd_12')) if data.get('odd_12') else None
            odd_x2 = float(data.get('odd_x2')) if data.get('odd_x2') else None
        except: return jsonify({"error": "Odds inválidas"}), 400

        if odd_h > 0: input_data['Imp_Home'] = 1/odd_h
        if odd_d > 0: input_data['Imp_Draw'] = 1/odd_d
        if odd_a > 0: input_data['Imp_Away'] = 1/odd_a

        try: input_data['Div_Code'] = le_div.transform([div])[0]
        except: input_data['Div_Code'] = 0

        # 3. Previsão
        X = pd.DataFrame([input_data])[features]
        exp_h = float(xgb_goals_h.predict(X)[0])
        exp_a = float(xgb_goals_a.predict(X)[0])
        probs = model_multi.predict_proba(X)[0]
        prob_a, prob_d, prob_h = float(probs[0]), float(probs[1]), float(probs[2])
        
        try: conf_shield = float(model_shield.predict_proba(X)[0][1])
        except: conf_shield = prob_h + prob_d

        best_score, best_prob = "0-0", -1
        for h in range(6):
            for a in range(6):
                p = poisson.pmf(h, exp_h) * poisson.pmf(a, exp_a)
                if p > best_prob: best_prob = p; best_score = f"{h} - {a}"

        # 4. Scanner & Análise
        opportunities = [] # Esta lista manterá a ordem de inserção

        def add(name, odd, prob):
            if not odd or odd <= 1: return
            ev = (prob * odd) - 1
            implied_prob = 1/odd # A percentagem que a casa espera
            
            if ev > 0.05: status = "💎 MUITO VALOR!"
            elif ev > 0: status = "✅ VALOR"
            elif ev > -0.05: status = "😐 JUSTO"
            else: status = "❌ FRACO"
            
            opportunities.append({
                "name": name, 
                "odd": odd, 
                "odd_prob": f"{implied_prob:.1%}", # Ex: "45.5%"
                "prob_raw": prob,
                "prob_txt": f"{prob:.1%}", # Ex: "42.3%"
                "fair_odd": f"{1/prob:.2f}" if prob > 0 else "99",
                "ev": ev,
                "status": status
            })

        # ORDEM FIXA PEDIDA: Casa -> Empate -> Fora -> 1X -> 12 -> X2
        add(f"Vitoria {home}", odd_h, prob_h)
        add("Empate", odd_d, prob_d)
        add(f"Vitoria {away}", odd_a, prob_a)
        
        p1x = ((prob_h + prob_d) + conf_shield)/2
        if odd_1x: add(f"DC 1X ({home} ou Empate)", odd_1x, p1x)
        if odd_12: add(f"DC 12 ({home} ou {away})", odd_12, prob_h + prob_a)
        if odd_x2: add(f"DC X2 ({away} ou Empate)", odd_x2, prob_a + prob_d)

        # Para calcular o "Melhor", criamos uma cópia ordenada, mas NÃO mexemos na lista 'opportunities' principal
        sorted_by_ev = sorted(opportunities, key=lambda x: x['ev'], reverse=True)
        rational = sorted_by_ev[0] if sorted_by_ev else None
        
        safe_list = sorted(opportunities, key=lambda x: x['prob_raw'], reverse=True)
        safe = safe_list[0] if safe_list else None

        return jsonify({
            'home': home, 'away': away,
            'xg': {'home': f"{exp_h:.2f}", 'away': f"{exp_a:.2f}"},
            'score': {'placar': best_score, 'prob': f"{best_prob:.1%}"},
            'scanner': opportunities, # Vai na ordem fixa
            'rational': rational,
            'safe': safe
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)