"""
Unit & Integration Tests for Crop Disease Detection Engine and Treatment Linking.
Architecture_Advisory.md §11, §14.
"""

from io import BytesIO
import numpy as np
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domain.advisory.disease_detector import (
    DISEASE_METADATA,
    DiseaseDetector,
    get_disease_detector,
)

client = TestClient(app)


def _create_sample_leaf_image(color=(50, 150, 40), size=(300, 300)) -> bytes:
    """Creates a sample green plant leaf image with texture."""
    arr = np.zeros((size[0], size[1], 3), dtype=np.uint8)
    arr[:, :] = color
    # Add some variable texture/lesion
    arr[100:150, 100:150] = (120, 80, 30)  # brown blight spot
    img = Image.fromarray(arr)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _create_noise_image(size=(300, 300)) -> bytes:
    """Creates an uninformative flat solid image representing non-leaf / bad photo."""
    arr = np.full((size[0], size[1], 3), 128, dtype=np.uint8)  # uniform grey
    img = Image.fromarray(arr)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_image_preprocessing():
    """Verify image loading, 224x224 resizing, and [-1, 1] normalization."""
    detector = get_disease_detector()
    img_bytes = _create_sample_leaf_image()

    arr, is_informative = detector.preprocess_image(img_bytes)

    assert arr.shape == (224, 224, 3)
    assert arr.min() >= -1.0
    assert arr.max() <= 1.0
    assert is_informative is True


class _StubModel:
    """Stands in for a trained Keras model: fixed probabilities over the class list."""

    def __init__(self, probs):
        self._probs = np.asarray(probs, dtype=float)

    def predict(self, batch, verbose=0):
        return np.asarray([self._probs])


def _detector_with_stub(probs, classes):
    det = DiseaseDetector(model_path="/nonexistent/model.keras")
    det._keras_model = _StubModel(probs)
    det.class_names = classes
    det.model_version = "stub"
    return det


def test_no_model_gives_no_diagnosis():
    """Without a trained model the API must not invent a disease (README §9: no fake data)."""
    det = DiseaseDetector(model_path="/nonexistent/model.keras")
    assert det.available is False
    key, conf, status = det.predict(_create_sample_leaf_image(), crop_hint="Tomato")
    assert key is None and conf == 0.0 and status == "low"
    res = det.diagnose(_create_sample_leaf_image(), crop="Tomato")
    assert res.status == "unavailable"
    assert res.treatments == []
    assert "KVK" in res.advisory_note


def test_unusable_photo_is_rejected_not_called_healthy():
    det = _detector_with_stub([0.9, 0.1], ["Tomato___healthy", "Tomato___Late_blight"])
    res = det.diagnose(_create_noise_image(), crop="Tomato")
    assert res.status == "rejected"
    assert "healthy" not in res.label.lower()


def test_model_labels_follow_training_order_and_crop_hint():
    classes = ["Corn___Common_rust", "Tomato___Late_blight", "Tomato___healthy"]
    det = _detector_with_stub([0.50, 0.40, 0.10], classes)
    # Without a crop hint, the maize class wins
    assert det.predict(_create_sample_leaf_image())[0] == "Corn___Common_rust"
    # With the crop known, only tomato classes compete and are renormalised: 0.4 / 0.5 = 0.8
    key, conf, status = det.predict(_create_sample_leaf_image(), crop_hint="Tomato")
    assert key == "Tomato___Late_blight"
    assert conf == 0.8 and status == "high"
    res = det.diagnose(_create_sample_leaf_image(), crop="Tomato")
    assert res.status == "model" and res.model_version == "stub"
    assert res.top_k[0]["label"] == "Tomato___Late_blight"


def test_disease_treatment_rag_linking():
    """A confident disease diagnosis links to verified RAG treatment extracts (§11)."""
    det = _detector_with_stub([0.95, 0.05], ["Tomato___Late_blight", "Tomato___healthy"])
    res = det.diagnose(_create_sample_leaf_image(), crop="Tomato")
    assert res.crop == "Tomato"
    assert res.label == DISEASE_METADATA["Tomato___Late_blight"]["display_name"]
    assert res.confidence_status == "high"
    for tx in res.treatments:
        assert tx.source_title != ""


def test_api_disease_check_endpoint():
    """Verify POST /api/advisory/disease-check multipart upload endpoint."""
    img_bytes = _create_sample_leaf_image()

    files = {"file": ("leaf.jpg", img_bytes, "image/jpeg")}
    data = {"crop": "Tomato"}

    resp = client.post("/api/advisory/disease-check", files=files, data=data)
    assert resp.status_code == 200, resp.text
    out = resp.json()

    assert out["crop"] == "Tomato"
    assert "label" in out
    assert "confidence" in out
    assert out["confidence_status"] in ("high", "moderate", "low")
    assert out["status"] in ("model", "unavailable", "rejected")
    assert "advisory_note" in out
    assert "treatments" in out


def test_api_disease_check_invalid_file():
    """Verify 400 rejection on empty or invalid file upload."""
    files = {"file": ("empty.jpg", b"", "image/jpeg")}
    resp = client.post("/api/advisory/disease-check", files=files)
    assert resp.status_code == 400
