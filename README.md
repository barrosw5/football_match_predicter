# ⚽ FPL Machine Learning: From Theory to Practice

Este repositório documenta a aplicação de conceitos fundamentais de **Aprendizagem Automática** (Machine Learning) a dados reais de futebol, especificamente para a **Fantasy Premier League (FPL)**.

O objetivo é transpor a teoria de sala de aula (implementação de algoritmos "do zero" com `numpy`) para um ambiente de produção utilizando bibliotecas profissionais (`scikit-learn`).

## 📋 O que este projeto contém

Este projeto foca-se em dois tipos principais de problemas de ML aplicados ao futebol:

### 1. Regressão Linear (Previsão de Pontos)
* **Objetivo:** Prever o número exato de pontos que um jogador fará numa jornada.
* **Matéria Aplicada:** *Linear Regression* com *Mean Squared Error (MSE)*.
* **Input:** Estatísticas do jogador (Creativity, Threat, Influence), Custo, Minutos jogados.
* **Output:** Valor contínuo (ex: `6.5` pontos).

### 2. Classificação Linear (Previsão de Resultados)
* **Objetivo:** Prever o desfecho de um jogo (Vitória Casa, Empate, Vitória Fora).
* **Matéria Aplicada:** *Linear Classification* usando *Softmax* e *Cross-Entropy Loss*.
* **Output:** Probabilidades para cada classe (ex: `[0.60, 0.25, 0.15]`).

## 🛠️ Stack Tecnológica

* **Linguagem:** Python 3
* **Ambiente:** VS Code + Jupyter Notebooks (`.ipynb`)
* **Bibliotecas:**
    * `pandas` & `numpy`: Manipulação de dados.
    * `matplotlib` & `seaborn`: Visualização de gráficos.
    * `scikit-learn`: Implementação otimizada dos modelos de ML.

## 📚 Dados

Os dados históricos utilizados são provenientes do repositório público da comunidade FPL:
* [Vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League)

---

### 🚀 Como Executar

1.  Instalar dependências: `pip install pandas numpy matplotlib seaborn scikit-learn jupyter`
2.  Abrir o VS Code.
3.  Executar o ficheiro `FPL_Project_Start.ipynb`.