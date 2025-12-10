// Definir data de hoje automaticamente
document.getElementById('date').valueAsDate = new Date();

document.getElementById('predictForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Mostrar Loader e esconder resultados antigos
    const resultArea = document.getElementById('resultArea');
    const loader = document.getElementById('loader');
    const content = document.getElementById('resultContent');
    const btn = document.getElementById('btnPredict');

    resultArea.classList.remove('hidden');
    loader.classList.remove('hidden');
    content.classList.add('hidden');
    btn.disabled = true;
    btn.innerText = "⏳ A calcular...";

    // 2. Recolher TODOS os dados do formulário
    const data = {
        division: document.getElementById('division').value,
        date: document.getElementById('date').value,
        home_team: document.getElementById('home_team').value,
        away_team: document.getElementById('away_team').value,
        
        // Odds Principais
        odd_h: parseFloat(document.getElementById('odd_h').value),
        odd_d: parseFloat(document.getElementById('odd_d').value),
        odd_a: parseFloat(document.getElementById('odd_a').value),
        
        // Odds Dupla Chance (Se estiver vazio, envia 0 ou null)
        odd_1x: parseFloat(document.getElementById('odd_1x').value) || 0,
        odd_12: parseFloat(document.getElementById('odd_12').value) || 0,
        odd_x2: parseFloat(document.getElementById('odd_x2').value) || 0
    };

    try {
        // --- MODO VERCEL (PRODUÇÃO) ---
        // Usamos apenas o caminho relativo. O Vercel sabe onde está a API.
        const response = await fetch('/api/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Erro na comunicação com o servidor');

        const result = await response.json();

        if (result.error) throw new Error(result.error);

        // Preencher Avisos
        if (result.warning) {
            document.getElementById('warningBox').classList.remove('hidden');
            document.getElementById('warningText').innerText = result.warning;
        } else {
            document.getElementById('warningBox').classList.add('hidden');
        }

        // Preencher Veredicto
        document.getElementById('bestPick').innerText = result.best_pick.name;
        document.getElementById('bestOdd').innerText = result.best_pick.odd;
        document.getElementById('bestEV').innerText = result.best_pick.ev_txt;
        
        document.getElementById('mostLikely').innerText = result.most_likely.name;
        document.getElementById('mostLikelyProb').innerText = result.most_likely.prob_txt;

        // Preencher xG
        document.getElementById('xgHome').innerText = result.xg.home;
        document.getElementById('xgAway').innerText = result.xg.away;
        document.getElementById('scorePred').innerText = result.most_likely_score;

        // Preencher Scanner
        const scannerDiv = document.getElementById('scannerList');
        scannerDiv.innerHTML = '';
        result.market_scanner.forEach(item => {
            let color = 'fraco';
            if (item.status.includes('VALOR')) color = 'valor';
            else if (item.status.includes('JUSTO')) color = 'justo';
            
            const html = `
                <div class="scanner-item">
                    <div>
                        <span class="market-name">${item.name}</span>
                        <span class="market-odd">(${item.odd})</span>
                    </div>
                    <div style="text-align:right">
                        <span class="prob-ia">IA: ${(item.prob*100).toFixed(1)}%</span>
                        <span class="tag ${color}">${item.status}</span>
                    </div>
                </div>`;
            scannerDiv.innerHTML += html;
        });

        // Preencher Heatmap
        const heatmapDiv = document.getElementById('heatmap');
        heatmapDiv.innerHTML = '';
        result.score_matrix.forEach((row, h) => {
            row.forEach((prob, a) => {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const p = prob * 100;
                cell.innerText = p >= 1 ? p.toFixed(0) + "%" : "";
                
                // Cores
                const opacity = Math.min(prob * 4, 1);
                cell.style.backgroundColor = `rgba(59, 130, 246, ${opacity})`;
                
                if (result.most_likely_score.startsWith(`${h}-${a}`)) {
                    cell.style.border = "2px solid #fbbf24";
                }
                heatmapDiv.appendChild(cell);
            });
        });

        document.getElementById('loader').classList.add('hidden');
        document.getElementById('resultContent').classList.remove('hidden');

    } catch (err) {
        alert("Erro: " + err.message);
        document.getElementById('loader').classList.add('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = "🔮 Calcular Previsão";
    }
});