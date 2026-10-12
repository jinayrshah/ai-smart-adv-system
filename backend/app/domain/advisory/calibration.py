"""
Probability calibration helpers shared by training (training/train_disease_model.py)
and inference (disease_detector.py). Pure numpy so they are testable without TensorFlow.

Why: the disease card turns softmax confidence into "high / moderate / low" wording
(Architecture §11). Modern CNNs are systematically over-confident; temperature scaling
(Guo et al., "On Calibration of Modern Neural Networks", ICML 2017) fits one scalar T on
the validation set so that p_i ∝ exp(z_i / T) matches observed accuracy, without
changing which class is predicted.
"""

from __future__ import annotations

import numpy as np

_EPS = 1e-12


def apply_temperature(probs: np.ndarray, temperature: float) -> np.ndarray:
    """Rescale softmax outputs: p ∝ p^(1/T) (identical to softmax(logits / T))."""
    p = np.clip(np.asarray(probs, dtype=float), _EPS, 1.0)
    if temperature is None or abs(temperature - 1.0) < 1e-9:
        return p / p.sum(axis=-1, keepdims=True)
    logits = np.log(p) / float(temperature)
    logits -= logits.max(axis=-1, keepdims=True)
    e = np.exp(logits)
    return e / e.sum(axis=-1, keepdims=True)


def negative_log_likelihood(probs: np.ndarray, labels: np.ndarray) -> float:
    p = np.clip(np.asarray(probs, dtype=float), _EPS, 1.0)
    labels = np.asarray(labels, dtype=int)
    return float(-np.mean(np.log(p[np.arange(len(labels)), labels])))


def fit_temperature(probs: np.ndarray, labels: np.ndarray, grid: np.ndarray | None = None) -> float:
    """Temperature minimising validation NLL (grid search; T > 1 softens over-confidence)."""
    grid = grid if grid is not None else np.round(np.arange(0.5, 5.01, 0.05), 2)
    best_t, best_nll = 1.0, float("inf")
    for t in grid:
        nll = negative_log_likelihood(apply_temperature(probs, float(t)), labels)
        if nll < best_nll:
            best_t, best_nll = float(t), nll
    return best_t


def expected_calibration_error(probs: np.ndarray, labels: np.ndarray, n_bins: int = 15) -> float:
    """ECE with equal-width confidence bins (Guo et al. 2017, eq. 3)."""
    p = np.asarray(probs, dtype=float)
    labels = np.asarray(labels, dtype=int)
    conf = p.max(axis=1)
    pred = p.argmax(axis=1)
    correct = (pred == labels).astype(float)
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (conf > lo) & (conf <= hi)
        if mask.any():
            ece += mask.mean() * abs(correct[mask].mean() - conf[mask].mean())
    return float(ece)
