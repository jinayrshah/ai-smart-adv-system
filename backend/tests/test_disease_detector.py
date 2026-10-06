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


def test_disease_prediction_on_leaf_image():
    """Verify prediction outputs registered disease class and confidence score."""
    detector = get_disease_detector()
    img_bytes = _create_sample_leaf_image()

    pred_class, conf, conf_status = detector.predict(img_bytes, crop_hint="Tomato")

    assert pred_class in DISEASE_METADATA
    assert 0.0 <= conf <= 1.0
    assert conf_status in ("high", "moderate", "low")


def test_uninformative_image_produces_low_confidence():
    """Verify non-leaf / uninformative images trigger low confidence (§11 acceptance)."""
    detector = get_disease_detector()
    noise_bytes = _create_noise_image()

    pred_class, conf, conf_status = detector.predict(noise_bytes, crop_hint="Tomato")

    assert conf < 0.60
    assert conf_status == "low"

    # Diagnose phrasing check
    res = detector.diagnose(noise_bytes, crop="Tomato")
    assert res.confidence_status == "low"
    assert "Low diagnostic confidence" in res.advisory_note or "KVK" in res.advisory_note


def test_disease_treatment_rag_linking():
    """Verify disease diagnosis automatically links to verified RAG treatment extracts (§11)."""
    detector = get_disease_detector()
    img_bytes = _create_sample_leaf_image()

    res = detector.diagnose(img_bytes, crop="Tomato")

    assert res.crop == "Tomato"
    assert res.label != ""
    assert isinstance(res.confidence, float)
    assert res.advisory_note != ""

    # If disease was identified with confidence, treatments list is populated
    if "Healthy" not in res.label and res.confidence >= 0.50:
        assert len(res.treatments) > 0
        top_tx = res.treatments[0]
        assert top_tx.source_title != ""
        assert len(top_tx.treatment_text) > 20


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
    assert "advisory_note" in out
    assert "treatments" in out


def test_api_disease_check_invalid_file():
    """Verify 400 rejection on empty or invalid file upload."""
    files = {"file": ("empty.jpg", b"", "image/jpeg")}
    resp = client.post("/api/advisory/disease-check", files=files)
    assert resp.status_code == 400
