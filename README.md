# ⚽ FPL Machine Learning: From Theory to Practice

This repository documents the application of fundamental **Machine Learning** concepts to real-world football data, specifically for the **Fantasy Premier League (FPL)**.

The main goal is to bridge the gap between classroom theory (implementing algorithms "from scratch" using `numpy`) and a production environment using professional libraries (`scikit-learn`).

## 📋 What this project contains

This project focuses on two main types of ML problems applied to football:

### 1. Linear Regression (Points Prediction)
* **Objective:** Predict the exact number of points a player will score in a gameweek.
* **Applied Theory:** *Linear Regression* with *Mean Squared Error (MSE)*.
* **Input:** Player stats (Creativity, Threat, Influence), Cost, Minutes played.
* **Output:** Continuous value (e.g., `6.5` points).

### 2. Linear Classification (Match Results Prediction)
* **Objective:** Predict the outcome of a match (Home Win, Draw, Away Win).
* **Applied Theory:** *Linear Classification* using *Softmax* and *Cross-Entropy Loss*.
* **Output:** Probabilities for each class (e.g., `[0.60, 0.25, 0.15]`).

## 🛠️ Tech Stack

* **Language:** Python 3
* **Environment:** VS Code + Jupyter Notebooks (`.ipynb`)
* **Libraries:**
    * `pandas` & `numpy`: Data manipulation.
    * `matplotlib` & `seaborn`: Data visualization.
    * `scikit-learn`: Optimized implementation of ML models.

## 📚 Data Source

Historical data is sourced from the community-maintained public repository:
* [Vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League)

---

### 🚀 How to Run

1.  Install dependencies: `pip install pandas numpy matplotlib seaborn scikit-learn jupyter`
2.  Open VS Code.
3.  Run the `FPL_Project_Start.ipynb` file.
