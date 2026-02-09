document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = "";

    // Elementos do DOM
    const dateInput = document.getElementById('match-date');
    const matchSelect = document.getElementById('quick-match');
    const form = document.getElementById('prediction-form');
    const resultArea = document.getElementById('result-area');
    const dateHidden = document.getElementById('match-date-hidden');

    // Caixas de Texto das Equipas
    const homeInput = document.getElementById('input-home');
    const awayInput = document.getElementById('input-away');

    // --- TRANSLATION SYSTEM ---
    const i18n = {
        en: {
            title: "AI Football Brain",
            subtitle: "Prediction powered by Machine Learning",
            match_date: "Match Date",
            select_match: "Select Match (API List)",
            awaiting_date: "Awaiting date...",
            loading_fixtures: "⏳ Loading fixtures...",
            select_match_default: "-- Select a Match --",
            no_fixtures: "⚠️ No games available for this date",
            error_connection: "❌ Connection error",
            home: "Home",
            away: "Away",
            placeholder_team: "Type Team Name",
            bookmaker_odds: "Bookmaker Odds",
            home_1: "Home (1)",
            draw_x: "Draw (X)",
            away_2: "Away (2)",
            analyze_btn: "Analyze Match",
            analyzing: "🔮 Consulting football stars...",
            error_select_teams: "Select a match OR type team names!",
            loading_odds: "Loading...",
            predict_error: "Prediction Error",
            rational: "Rational",
            safe: "Safe Bet",
            market: "Market",
            bookie: "Bookie",
            value: "Value",
            probs_matrix: "Probability Matrix (Exact Score)",
            expected_goals: "EXPECTED GOALS (AI)",
            goals: "goals",
            btts: "Both Teams to Score",
            likely_score: "Most Likely Score",
            very_high_value: "💎 HIGH VALUE!",
            value_bet: "✅ VALUE",
            fair: "😐 FAIR",
            poor: "❌ POOR"
        },
        pt: {
            title: "Cérebro de Futebol IA",
            subtitle: "Previsões baseadas em Machine Learning",
            match_date: "Data do Jogo",
            select_match: "Selecionar Jogo (Lista da API)",
            awaiting_date: "A aguardar data...",
            loading_fixtures: "⏳ A carregar jogos...",
            select_match_default: "-- Seleciona um Jogo --",
            no_fixtures: "⚠️ Sem jogos disponíveis para esta data",
            error_connection: "❌ Erro de conexão",
            home: "Casa",
            away: "Fora",
            placeholder_team: "Escreve a Equipa",
            bookmaker_odds: "Odds da Casa de Apostas",
            home_1: "Casa (1)",
            draw_x: "Empate (X)",
            away_2: "Fora (2)",
            analyze_btn: "Analisar Jogo",
            analyzing: "🔮 A consultar os astros do futebol...",
            error_select_teams: "Seleciona um jogo OU escreve os nomes das equipas!",
            loading_odds: "A carregar...",
            predict_error: "Erro na Previsão",
            rational: "Racional",
            safe: "Seguro",
            market: "Mercado",
            bookie: "Casa",
            value: "Valor",
            probs_matrix: "Matriz de Probabilidades (Resultado Exato)",
            expected_goals: "GOLOS ESPERADOS (IA)",
            goals: "golos",
            btts: "Ambas Marcam",
            likely_score: "Placar Mais Provável",
            very_high_value: "💎 MUITO VALOR!",
            value_bet: "✅ VALOR",
            fair: "😐 JUSTO",
            poor: "❌ FRACO"
        }
    };

    let currentLang = 'en'; // Default to English

    const updateLanguage = () => {
        const langData = i18n[currentLang];

        // Update Text Elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (langData[key]) el.textContent = langData[key];
        });

        // Update Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (langData[key]) el.placeholder = langData[key];
        });

        // Update Toggle Button Text
        const btnText = document.querySelector('#lang-toggle .lang-text');
        if (btnText) btnText.textContent = currentLang === 'en' ? 'PT' : 'EN';
    };

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', () => {
            currentLang = currentLang === 'en' ? 'pt' : 'en';
            updateLanguage();
            // Re-render fixtures dropdown text if loaded
            if (matchSelect.options.length > 1 && matchSelect.options[0].value === "") {
                matchSelect.options[0].text = i18n[currentLang].select_match_default;
            }
        });
    }

    // Initialize Language
    updateLanguage();


    // --- CAIXAS DAS ODDS ---
    const getInput = (name) => document.querySelector(`input[name="${name}"]`) || document.getElementById(name);

    const inputH = getInput('odd_h');
    const inputD = getInput('odd_d');
    const inputA = getInput('odd_a');
    const input1X = getInput('odd_1x');
    const input12 = getInput('odd_12');
    const inputX2 = getInput('odd_x2');

    const allOddInputs = [inputH, inputD, inputA, input1X, input12, inputX2];

    // Define a data de hoje
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateHidden.value = today;

    // --- FUNÇÃO DE FORMATAÇÃO FORÇADA (2 CASAS) ---
    const formatOdd = (val) => {
        if (!val || val == 0 || val === "N/A") return "";
        return Number(val).toFixed(2);
    };

    // --- 1. PREENCHIMENTO AUTOMÁTICO ---
    matchSelect.addEventListener('change', async () => {
        const selectedValue = matchSelect.value;

        if (selectedValue) {
            try {
                const matchData = JSON.parse(selectedValue);

                // Preenche Equipas
                if (homeInput) homeInput.value = matchData.home_team || matchData.homeTeam;
                if (awayInput) awayInput.value = matchData.away_team || matchData.awayTeam;

                // Feedback "A carregar..."
                allOddInputs.forEach(el => {
                    if (el) { el.value = ""; el.placeholder = "A carregar..."; }
                });

                // Pedir Odds (Usa o ID da nova API)
                if (matchData.id) {
                    console.log(`📡 A pedir odds ID: ${matchData.id}`);

                    const res = await fetch(`${API_BASE}/api/odds`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fixture_id: matchData.id })
                    });

                    const oddsData = await res.json();

                    if (oddsData.error) {
                        console.warn("Aviso API:", oddsData.error);
                        allOddInputs.forEach(el => { if (el) el.placeholder = "N/A"; });
                    } else {
                        if (inputH) inputH.value = formatOdd(oddsData.odd_h);
                        if (inputD) inputD.value = formatOdd(oddsData.odd_d);
                        if (inputA) inputA.value = formatOdd(oddsData.odd_a);

                        // A API Grátis não dá estas, ficam a 0 ou manual
                        if (input1X) input1X.value = formatOdd(oddsData.odd_1x);
                        if (input12) input12.value = formatOdd(oddsData.odd_12);
                        if (inputX2) inputX2.value = formatOdd(oddsData.odd_x2);

                        allOddInputs.forEach(el => el.placeholder = "1.00");
                    }
                }

            } catch (e) {
                console.error("Erro:", e);
                allOddInputs.forEach(el => el.placeholder = "Erro");
            }
        } else {
            if (homeInput) homeInput.value = "";
            if (awayInput) awayInput.value = "";
            allOddInputs.forEach(el => { if (el) { el.value = ""; el.placeholder = "1.00"; } });
        }
    });

    // --- 2. FETCH JOGOS ---
    async function fetchFixtures(date) {
        matchSelect.disabled = true;
        matchSelect.innerHTML = '<option>⏳ A carregar jogos...</option>';
        if (homeInput) homeInput.value = "";
        if (awayInput) awayInput.value = "";

        try {
            const res = await fetch(`${API_BASE}/api/fixtures`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: date })
            });
            const matches = await res.json();
            matchSelect.innerHTML = `<option value="">${i18n[currentLang].select_match_default}</option>`;

            if (matches.length === 0) {
                matchSelect.innerHTML = `<option value="">${i18n[currentLang].no_fixtures}</option>`;
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
                        const statusIcon = (m.status_short === 'FT') ? '🏁' : '⏰';
                        opt.textContent = `${m.match_time} ${statusIcon} ${m.home_team} vs ${m.away_team}`;
                        group.appendChild(opt);
                    });
                    matchSelect.appendChild(group);
                }
            }
        } catch (e) {
            console.error(e);
            matchSelect.innerHTML = `<option>${i18n[currentLang].error_connection}</option>`;
        } finally {
            matchSelect.disabled = false;
        }
    }

    // Carrega jogos quando mudas a data
    dateInput.addEventListener('change', (e) => {
        dateHidden.value = e.target.value;
        fetchFixtures(e.target.value);
    });

    // --- 3. SUBMETER PREVISÃO ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validação híbrida (Manual ou Automática)
        if (!matchSelect.value && (!homeInput.value || !awayInput.value)) {
            return alert("Seleciona um jogo OU escreve os nomes das equipas!");
        }

        let mData = {};
        try {
            if (matchSelect.value) mData = JSON.parse(matchSelect.value);
        } catch (e) { }

        const payload = {
            date: dateHidden.value,
            home_team: homeInput.value, // Usa sempre o valor da caixa de texto
            away_team: awayInput.value,
            division: mData.division || 'E0',
            odd_h: parseFloat(inputH.value) || 0,
            odd_d: parseFloat(inputD.value) || 0,
            odd_a: parseFloat(inputA.value) || 0,
            odd_1x: parseFloat(input1X.value) || 0,
            odd_12: parseFloat(input12.value) || 0,
            odd_x2: parseFloat(inputX2.value) || 0
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

            // FUNÇÃO PARA GERAR A MATRIZ DE RESULTADOS (Heatmap)
            // Conta de baixo (0) para cima (5) no eixo Y
            const generateMatrixHTML = (matrix) => {
                let html = '<div class="score-matrix">';

                // 1. Calcular o valor máximo para fazer a escala de cores relativa
                const maxVal = Math.max(...matrix.flat());

                // 2. Gerar as Células (Golos Casa vs Fora)
                // Nota: Removemos o cabeçalho daqui do topo

                for (let h = 5; h >= 0; h--) {
                    // Etiqueta do Eixo Y (Equipa da Casa)
                    html += `<div class="matrix-row-label">${h}</div>`;

                    for (let a = 0; a < 6; a++) {
                        const prob = matrix[h][a];
                        const perc = (prob * 100).toFixed(1);

                        // CÁLCULO DO DEGRADÊ (COR DINÂMICA)
                        // Calcula a intensidade de 0 a 1 baseada no valor máximo
                        const intensity = prob / maxVal;

                        // Define a cor (Verde Esmeralda: 16, 185, 129).
                        // A opacidade (alpha) vai de 0.10 (mínimo) até 0.95 (máximo)
                        const alpha = 0.1 + (intensity * 0.85);

                        // Se a cor for muito escura/transparente, texto cinza. Se for forte, texto branco.
                        const textColor = intensity > 0.5 ? '#ffffff' : '#94a3b8';

                        const isBest = prob === maxVal;
                        const borderStyle = isBest ? "border: 2px solid #fbbf24;" : "";
                        const transformStyle = isBest ? "transform: scale(1.1); z-index: 10;" : "";

                        // Aplicamos o estilo inline para a cor exata
                        html += `<div class="matrix-cell" 
                                      title="${data.home} ${h} - ${a} ${data.away}"
                                      style="background-color: rgba(16, 185, 129, ${alpha}); 
                                             color: ${textColor}; 
                                             ${borderStyle} 
                                             ${transformStyle}">
                                    ${perc}%
                                 </div>`;
                    }
                }

                // 3. Rodapé (Golos Fora - Visitante) - MOVIDO PARA BAIXO
                // Célula vazia no canto inferior esquerdo (debaixo dos labels Y)
                html += '<div></div>';

                // Loop para os números 0 1 2 3 4 5
                for (let a = 0; a < 6; a++) {
                    html += `<div class="matrix-header" style="padding-top: 5px;">${a}</div>`;
                }

                html += '</div>';
                return html;
            };

            const formatEV = (val) => (val * 100).toFixed(1) + "%";

            let scannerHTML = data.scanner.map(s => {
                let badgeClass = s.status.includes('MUITO') ? "badge-gem" :
                    s.status.includes('VALOR') ? "badge-good" :
                        s.status.includes('JUSTO') ? "badge-fair" : "badge-bad";
                let icon = s.status.includes('MUITO') ? "💎 " :
                    s.status.includes('VALOR') ? "✅ " :
                        s.status.includes('JUSTO') ? "😐 " : "❌ ";

                return `<div class="scanner-item">
                    <div class="market-name">${s.name}</div>
                    <div class="data-col"><span style="font-weight:bold;">@${s.odd.toFixed(2)}</span><span style="font-size:0.85em; color:#94a3b8;">(${s.odd_prob})</span></div>
                    <div class="data-col"><span style="font-weight:bold; color:var(--primary)">@${s.fair_odd}</span><span style="font-size:0.85em; color:#94a3b8;">(${s.prob_txt})</span></div>
                    <div class="status-badge ${badgeClass}">${icon}${s.status.replace(/.* /, '')}</div>
                </div>`;
            }).join('');

            resultArea.innerHTML = `
                <h3>${data.home} <span style="color:#64748b; font-size:0.8em">vs</span> ${data.away}</h3>
                
                <div class="xg-stats-box">
                    <div class="xg-title">📊 ${i18n[currentLang].expected_goals}</div>
                    <div class="xg-content">
                        <div class="xg-item">
                            ⚽ ${data.home}: <strong style="color:var(--primary)">${data.xg.home}</strong> ${i18n[currentLang].goals}
                        </div>
                        <div class="xg-item">
                            ⚽ ${data.away}: <strong style="color:var(--primary)">${data.xg.away}</strong> ${i18n[currentLang].goals}
                        </div>
                        
                        <div class="xg-item" style="width: 100%; border-top: 1px solid #334155; margin-top: 5px; padding-top: 5px;">
                            🥅 ${i18n[currentLang].btts}: <strong style="color:var(--primary)">${data.btts}</strong>
                        </div>

                        <div class="xg-item highlight-score" style="margin-top: 10px;">
                            🎯 ${i18n[currentLang].likely_score}: <strong>${data.score.placar}</strong> (${data.score.prob})
                        </div>
                    </div>
                </div>

                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom:10px; color:var(--text-muted); font-size:0.9rem; text-align:center;">${i18n[currentLang].probs_matrix}</h4>
                    <div class="matrix-container-wrapper">
                        <div class="matrix-axis-y">🏠 ${data.home}</div>
                        <div style="flex:1">
                            ${generateMatrixHTML(data.matrix)}
                            <div class="matrix-axis-x" style="margin-top: 5px; margin-bottom: 0;">✈️ ${data.away}</div>
                        </div>
                    </div>
                </div>

                <div class="scanner-container" style="margin-top:25px;">
                    <div class="scanner-header">
                        <div>${i18n[currentLang].market}</div>
                        <div style="text-align:center;">${i18n[currentLang].bookie}</div>
                        <div style="text-align:center;">IA</div>
                        <div style="text-align:center;">${i18n[currentLang].value}</div>
                    </div>
                    ${scannerHTML}
                </div>

                <div style="margin-top:25px;">
                    ${data.rational ? `
                    <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-left: 4px solid #10b981; margin-bottom: 10px; border-radius: 4px;">
                        <h4 style="margin:0; color: #10b981;">🏆 ${i18n[currentLang].rational}: ${data.rational.name}</h4>
                        <div>EV: +${formatEV(data.rational.ev)}</div>
                    </div>` : ''}
                    
                    ${data.safe ? `
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
                        <h4 style="margin:0; color: #3b82f6;">🛡️ ${i18n[currentLang].safe}: ${data.safe.name}</h4>
                        <div>${i18n[currentLang].value}: ${data.safe.prob_txt}</div>
                    </div>` : ''}
                </div>
            `;

        } catch (err) {
            resultArea.innerHTML = `<div class="error-box">❌ ${err.message}</div>`;
        }
    });
});