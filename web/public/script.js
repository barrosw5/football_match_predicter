document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = "http://127.0.0.1:5000";
    
    const dateInput = document.getElementById('match-date');
    const matchSelect = document.getElementById('quick-match');
    const form = document.getElementById('prediction-form');
    const resultArea = document.getElementById('result-area');
    const dateHidden = document.getElementById('match-date-hidden');

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateHidden.value = today;

    // --- 1. FETCH JOGOS ---
    async function fetchFixtures(date) {
        matchSelect.disabled = true;
        matchSelect.innerHTML = '<option>⏳ A carregar jogos...</option>';
        
        try {
            const res = await fetch(`${API_BASE}/api/fixtures`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: date })
            });
            
            const matches = await res.json();
            matchSelect.innerHTML = '<option value="">-- Seleciona um Jogo --</option>';

            if (matches.length === 0) {
                matchSelect.innerHTML = '<option>⚠️ Sem jogos disponíveis</option>';
            } else {
                const groups = {};
                matches.forEach(m => {
                    const league = `${m.league_name} (${m.country})`;
                    if (!groups[league]) groups[league] = [];
                    groups[league].push(m);
                });

                for (const [leagueName, games] of Object.entries(groups)) {
                    const group = document.createElement('optgroup');
                    group.label = leagueName;
                    games.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = JSON.stringify(m);
                        const home = m.home_team || m.homeTeam;
                        const away = m.away_team || m.awayTeam;
                        opt.textContent = `${m.match_time} ⏰ ${home} vs ${away}`;
                        group.appendChild(opt);
                    });
                    matchSelect.appendChild(group);
                }
            }
        } catch (e) {
            console.error(e);
            matchSelect.innerHTML = '<option>❌ Erro de conexão</option>';
        } finally {
            matchSelect.disabled = false;
        }
    }

    dateInput.addEventListener('change', (e) => {
        dateHidden.value = e.target.value;
        fetchFixtures(e.target.value);
    });

    // --- 2. GERAR PREVISÃO COM NOVO DESIGN ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!matchSelect.value) return alert("Seleciona um jogo!");

        const mData = JSON.parse(matchSelect.value);
        const formData = new FormData(form);

        const payload = {
            date: dateHidden.value,
            home_team: mData.home_team || mData.homeTeam,
            away_team: mData.away_team || mData.awayTeam,
            division: mData.division || 'E0',
            odd_h: formData.get('odd_h'), odd_d: formData.get('odd_d'), odd_a: formData.get('odd_a'),
            odd_1x: formData.get('odd_1x'), odd_12: formData.get('odd_12'), odd_x2: formData.get('odd_x2')
        };

        resultArea.innerHTML = '<div class="loading">🔮 A consultar os astros do futebol...</div>';

        try {
            const res = await fetch(`${API_BASE}/api/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const formatEV = (val) => (val * 100).toFixed(1) + "%";

            // --- CONSTRUÇÃO DO SCANNER ---
            let scannerHTML = data.scanner.map(s => {
                let badgeClass = "badge-bad";
                let icon = "";
                
                if (s.status.includes('MUITO')) { badgeClass = "badge-gem"; icon = "💎 "; }
                else if (s.status.includes('VALOR')) { badgeClass = "badge-good"; icon = "✅ "; }
                else if (s.status.includes('JUSTO')) { badgeClass = "badge-fair"; icon = "😐 "; }
                else { badgeClass = "badge-bad"; icon = "❌ "; }

                return `
                <div class="scanner-item">
                    <div class="market-name">${s.name}</div>
                    
                    <div class="data-col">
                        <span class="data-val">@${s.odd.toFixed(2)}</span>
                        <span class="data-perc">Casa: ${s.odd_prob}</span>
                    </div>
                    
                    <div class="data-col">
                        <span class="data-val" style="color:var(--primary)">@${s.fair_odd}</span>
                        <span class="data-perc">IA: ${s.prob_txt}</span>
                    </div>
                    
                    <div class="status-badge ${badgeClass}">${icon}${s.status.replace(/.* /, '')}</div>
                </div>`;
            }).join('');

            // Paineis de Resumo (Racional e Seguro)
            let rationalHTML = data.rational ? `
                <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-left: 4px solid #10b981; margin-bottom: 10px; border-radius: 4px;">
                    <h4 style="margin:0 0 5px 0; color: #10b981; font-size: 0.9rem; text-transform: uppercase;">🏆 Escolha Racional (EV Máximo)</h4>
                    <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 4px;">👉 ${data.rational.name}</div>
                    <div style="font-size: 0.9rem; color: #cbd5e1;">
                        Odd: <span style="color:#fff; font-weight:bold;">${data.rational.odd.toFixed(2)}</span> | 
                        EV: <span style="color:#10b981; font-weight:bold;">+${formatEV(data.rational.ev)}</span>
                    </div>
                </div>` : '';

            let safeHTML = data.safe ? `
                <div style="background: rgba(59, 130, 246, 0.1); padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
                    <h4 style="margin:0 0 5px 0; color: #3b82f6; font-size: 0.9rem; text-transform: uppercase;">🛡️ Escolha Segura (Probabilidade)</h4>
                    <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 4px;">👉 ${data.safe.name}</div>
                    <div style="font-size: 0.9rem; color: #cbd5e1;">
                        Confiança: <span style="color:#fff; font-weight:bold;">${data.safe.prob_txt}</span>
                    </div>
                    ${data.safe.ev < 0 ? '<div style="color: #f59e0b; font-size: 0.8rem; margin-top:5px;">⚠️ Odd baixa (EV Negativo). Cuidado.</div>' : ''}
                </div>` : '';

            // RENDER FINAL
            resultArea.innerHTML = `
                <h3 style="border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 20px;">
                    <i class="fa-solid fa-futbol"></i> ${data.home} <span style="color:#64748b">vs</span> ${data.away}
                </h3>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 25px;">
                    <div class="stat-item">
                        <span style="color:#94a3b8; font-size:0.8rem;">Expected Goals (xG)</span>
                        <div style="margin-top:5px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                                <span>${data.home}</span> <strong>${data.xg.home}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>${data.away}</span> <strong>${data.xg.away}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="stat-item" style="justify-content:center;">
                        <span style="color:#94a3b8; font-size:0.8rem;">Placar Provável</span>
                        <strong style="font-size:1.4rem; color:var(--primary);">${data.score.placar}</strong>
                        <small>(${data.score.prob})</small>
                    </div>
                </div>

                <div class="scanner-container">
                    <div class="scanner-header">
                        <div>Mercado</div>
                        <div>Bookie (Impl.)</div>
                        <div>IA (Real)</div>
                        <div style="text-align:center;">Valor</div>
                    </div>
                    ${scannerHTML}
                </div>
                
                <div style="margin-top: 25px;">
                    ${rationalHTML}
                    ${safeHTML}
                </div>
            `;

        } catch (err) {
            resultArea.innerHTML = `<div class="error-box">❌ ${err.message}</div>`;
        }
    });

    fetchFixtures(dateInput.value);
});