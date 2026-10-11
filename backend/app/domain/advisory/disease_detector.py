"""
Crop Disease Detection Engine.
Architecture_Advisory.md §11, §10.3, §14.

Performs forward inference on leaf imagery, estimates confidence, detects uninformative/noise images,
and automatically links the identified disease label to verified RAG treatment recommendations.
"""

from io import BytesIO
import json
import logging
import os
from pathlib import Path
from typing import Any, Literal
import numpy as np
from PIL import Image

from app.domain.advisory.calibration import apply_temperature
from app.domain.advisory.retrieve import retrieve
from app.schemas.advisory import DiseaseCheckResponse, DiseaseTreatmentExtract

logger = logging.getLogger(__name__)

# Disease metadata catalog for the 6 target crops
DISEASE_METADATA: dict[str, dict[str, Any]] = {
    # Tomato
    "Tomato___Late_blight": {
        "crop": "Tomato",
        "display_name": "Tomato Late Blight",
        "scientific_name": "Phytophthora infestans",
        "typical_symptoms": "Water-soaked dark lesions on leaves, white fungal growth under humid conditions.",
    },
    "Tomato___Early_blight": {
        "crop": "Tomato",
        "display_name": "Tomato Early Blight",
        "scientific_name": "Alternaria solani",
        "typical_symptoms": "Concentric rings/target-board spots starting on older lower foliage.",
    },
    "Tomato___Bacterial_spot": {
        "crop": "Tomato",
        "display_name": "Tomato Bacterial Spot",
        "scientific_name": "Xanthomonas perforans",
        "typical_symptoms": "Small brown/black circular lesions with yellow halos on foliage and fruit.",
    },
    "Tomato___Yellow_Leaf_Curl_Virus": {
        "crop": "Tomato",
        "display_name": "Tomato Yellow Leaf Curl Virus",
        "scientific_name": "Begomovirus (Whitefly-transmitted)",
        "typical_symptoms": "Upward curling and severe yellowing of leaf margins, stunted plant growth.",
    },
    "Tomato___healthy": {
        "crop": "Tomato",
        "display_name": "Tomato Healthy",
        "scientific_name": None,
        "typical_symptoms": "Vibrant green foliage without necrotic spots or wilting.",
    },
    # Wheat
    "Wheat___Yellow_rust": {
        "crop": "Wheat",
        "display_name": "Wheat Yellow Rust (Stripe Rust)",
        "scientific_name": "Puccinia striiformis",
        "typical_symptoms": "Parallel yellowish-orange pustule stripes along leaf veins in cool climates.",
    },
    "Wheat___Brown_rust": {
        "crop": "Wheat",
        "display_name": "Wheat Brown Rust (Leaf Rust)",
        "scientific_name": "Puccinia triticina",
        "typical_symptoms": "Scattered round brownish-orange pustules predominantly on leaf blades.",
    },
    "Wheat___Powdery_mildew": {
        "crop": "Wheat",
        "display_name": "Wheat Powdery Mildew",
        "scientific_name": "Blumeria graminis",
        "typical_symptoms": "White to grayish powdery fungal patches on leaves and stems.",
    },
    "Wheat___healthy": {
        "crop": "Wheat",
        "display_name": "Wheat Healthy",
        "scientific_name": None,
        "typical_symptoms": "Normal erect tillers and green flag leaves without lesions.",
    },
    # Cotton
    "Cotton___Bacterial_blight": {
        "crop": "Cotton",
        "display_name": "Cotton Bacterial Blight (Black Arm)",
        "scientific_name": "Xanthomonas citri pv. malvacearum",
        "typical_symptoms": "Angular water-soaked leaf lesions delimited by veins, blackening of twigs.",
    },
    "Cotton___Pink_bollworm": {
        "crop": "Cotton",
        "display_name": "Cotton Pink Bollworm Damage",
        "scientific_name": "Pectinophora gossypiella",
        "typical_symptoms": "Rosetted flowers, entry holes in developing bolls, damaged lint.",
    },
    "Cotton___healthy": {
        "crop": "Cotton",
        "display_name": "Cotton Healthy",
        "scientific_name": None,
        "typical_symptoms": "Broad lobed green leaves without necrotic spots.",
    },
    # Soybean
    "Soybean___Rust": {
        "crop": "Soybean",
        "display_name": "Soybean Asian Rust",
        "scientific_name": "Phakopsora pachyrhizi",
        "typical_symptoms": "Tiny tan to reddish-brown pustules on undersides of trifoliate leaves.",
    },
    "Soybean___Bacterial_pustule": {
        "crop": "Soybean",
        "display_name": "Soybean Bacterial Pustule",
        "scientific_name": "Xanthomonas axonopodis pv. glycines",
        "typical_symptoms": "Light green spots with raised pustules in the center without yellow halos.",
    },
    "Soybean___healthy": {
        "crop": "Soybean",
        "display_name": "Soybean Healthy",
        "scientific_name": None,
        "typical_symptoms": "Clean trifoliate green foliage.",
    },
    # Rice
    "Rice___Blast": {
        "crop": "Rice",
        "display_name": "Rice Blast",
        "scientific_name": "Magnaporthe oryzae",
        "typical_symptoms": "Spindle/diamond-shaped lesions with gray-white centers and brownish borders.",
    },
    "Rice___Bacterial_leaf_blight": {
        "crop": "Rice",
        "display_name": "Rice Bacterial Leaf Blight",
        "scientific_name": "Xanthomonas oryzae",
        "typical_symptoms": "Wavy, water-soaked yellowish lesions progressing from leaf tips down margins.",
    },
    "Rice___healthy": {
        "crop": "Rice",
        "display_name": "Rice Healthy",
        "scientific_name": None,
        "typical_symptoms": "Uniform erect tillers and clean green foliage.",
    },
    # Maize
    "Corn___Common_rust": {
        "crop": "Maize",
        "display_name": "Maize Common Rust",
        "scientific_name": "Puccinia sorghi",
        "typical_symptoms": "Golden-brown to cinnamon powdery pustules scattered on upper and lower surfaces.",
    },
    "Corn___Northern_Leaf_Blight": {
        "crop": "Maize",
        "display_name": "Maize Northern Leaf Blight",
        "scientific_name": "Exserohilum turcicum",
        "typical_symptoms": "Long, elliptical cigar-shaped grayish-green lesions turning tan.",
    },
    "Corn___healthy": {
        "crop": "Maize",
        "display_name": "Maize Healthy",
        "scientific_name": None,
        "typical_symptoms": "Healthy dark green whorls and clean leaves.",
    },
}

ALL_CLASSES = list(DISEASE_METADATA.keys())


BACKEND_ROOT = Path(__file__).resolve().parents[3]

# Dataset folder prefixes -> project crop names (PlantVillage writes maize as "Corn_(maize)")
CROP_ALIASES = {"corn_(maize)": "Maize", "corn": "Maize", "maize": "Maize", "soybean": "Soybean",
                "tomato": "Tomato", "rice": "Rice", "wheat": "Wheat", "cotton": "Cotton"}


def metadata_key(class_name: str) -> str:
    """Map a dataset class folder name onto DISEASE_METADATA's key, when one exists."""
    if class_name in DISEASE_METADATA:
        return class_name
    crop, _, label = class_name.partition("___")
    crop = "Corn" if crop.lower().startswith("corn") else crop
    label = label.strip("_ ")
    if label.lower().startswith(crop.lower() + "_"):  # "Tomato___Tomato_Yellow_Leaf_Curl_Virus"
        label = label[len(crop) + 1:]
    candidate = f"{crop}___{label}"
    if candidate in DISEASE_METADATA:
        return candidate
    norm = candidate.lower().replace(" ", "_")
    return next((k for k in DISEASE_METADATA if k.lower() == norm), class_name)


def crop_of(class_name: str) -> str:
    key = metadata_key(class_name)
    if key in DISEASE_METADATA:
        return DISEASE_METADATA[key]["crop"]
    prefix = class_name.split("___")[0]
    return CROP_ALIASES.get(prefix.lower(), prefix.replace("_", " "))
DEFAULT_MODEL_PATH = BACKEND_ROOT / "models" / "disease_mobilenetv2_v1.keras"


class DiseaseDetector:
    """
    MobileNetV2 leaf-disease classifier (Architecture §11).

    Honesty rules (README §9 "no fake data"):
    - No trained model installed -> status "unavailable" and NO diagnosis. The first
      version guessed a disease from colour ratios with an invented confidence.
    - Unusable photo (blank, too dark/bright) -> status "rejected", never "healthy".
    - Class names come from the `disease_classes.json` written by
      training/train_disease_model.py (Keras orders classes alphabetically by folder),
      not from this module's dict order, which would silently mislabel predictions.
    - When the farmer's crop is known, only that crop's classes compete (renormalised),
      which removes cross-crop confusions.
    """

    def __init__(self, model_path: str | Path | None = None, classes_path: str | Path | None = None):
        env_path = os.getenv("DISEASE_MODEL_PATH")
        self.model_path = Path(model_path or env_path or DEFAULT_MODEL_PATH)
        if not self.model_path.is_absolute():
            self.model_path = BACKEND_ROOT / self.model_path
        self.classes_path = Path(classes_path) if classes_path else self.model_path.parent / "disease_classes.json"
        self.meta_path = self.model_path.parent / "disease_model_meta.json"
        self._keras_model = None
        self.class_names: list[str] = []
        self.model_version: str | None = None
        self.temperature = 1.0
        # training/train_disease_model.py builds MobileNetV2 preprocessing into the model,
        # so it expects raw 0-255 pixels. Scaling to [-1, 1] here as well (what the first
        # version did) would feed the network near-constant inputs.
        self.model_includes_preprocessing = True
        self._load_keras_model_if_exists()

    def _load_keras_model_if_exists(self):
        if not self.model_path.exists():
            logger.info(f"No disease model at {self.model_path}; disease checks will report 'unavailable'.")
            return
        try:
            import tensorflow as tf  # optional heavy dependency

            self._keras_model = tf.keras.models.load_model(str(self.model_path))
            self.model_version = self.model_path.stem
        except Exception as e:
            logger.warning(f"Could not load Keras model: {e}")
            return
        meta = {}
        if self.meta_path.exists():
            meta = json.loads(self.meta_path.read_text(encoding="utf-8"))
            self.temperature = float(meta.get("temperature") or 1.0)
            self.model_includes_preprocessing = meta.get("preprocessing", "model_includes_mobilenet_v2_preprocess") \
                == "model_includes_mobilenet_v2_preprocess"
        if meta.get("classes"):
            self.class_names = list(meta["classes"])
        elif self.classes_path.exists():
            self.class_names = json.loads(self.classes_path.read_text(encoding="utf-8"))
        else:
            self.class_names = sorted(ALL_CLASSES)
            logger.warning(f"{self.classes_path} missing; assuming alphabetical class order.")

    @property
    def available(self) -> bool:
        return self._keras_model is not None and bool(self.class_names)

    def preprocess_image(self, image_bytes: bytes) -> tuple[np.ndarray, bool]:
        """
        Loads image, resizes to (224, 224), scales to [-1, 1], and assesses plant signal quality.
        Returns (preprocessed_array, is_valid_plant_imagery).
        """
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        img_resized = img.resize((224, 224), Image.Resampling.BILINEAR)
        arr = np.array(img_resized, dtype=np.float32)
        std_val = float(np.std(arr))
        mean_val = float(np.mean(arr))
        is_informative = std_val > 15.0 and 10.0 < mean_val < 245.0
        arr_norm = (arr / 127.5) - 1.0  # MobileNetV2 preprocessing
        return arr_norm, is_informative

    def predict_detailed(self, image_bytes: bytes, crop_hint: str | None = None) -> dict[str, Any]:
        arr_norm, is_informative = self.preprocess_image(image_bytes)
        if not is_informative:
            return {"status": "rejected", "key": None, "confidence": 0.0, "confidence_status": "low", "top_k": []}
        if not self.available:
            return {"status": "unavailable", "key": None, "confidence": 0.0, "confidence_status": "low", "top_k": []}

        model_input = (arr_norm + 1.0) * 127.5 if self.model_includes_preprocessing else arr_norm
        raw = np.asarray(self._keras_model.predict(np.expand_dims(model_input, axis=0), verbose=0)[0], dtype=float)
        probs = apply_temperature(raw, self.temperature)
        names = self.class_names[: len(probs)]
        idx = list(range(len(names)))
        if crop_hint:
            crop_idx = [i for i in idx if crop_of(names[i]).lower() == crop_hint.strip().lower()]
            if crop_idx:
                idx = crop_idx
        sub = probs[idx]
        total = float(sub.sum()) or 1.0
        ranked = sorted(((names[i], float(probs[i]) / total) for i in idx), key=lambda t: t[1], reverse=True)
        key, conf = ranked[0]
        status = "high" if conf >= 0.75 else "moderate" if conf >= 0.60 else "low"
        return {
            "status": "model",
            "key": key,
            "confidence": round(conf, 2),
            "confidence_status": status,
            "top_k": [{"label": k, "confidence": round(c, 3)} for k, c in ranked[:3]],
        }

    def predict(self, image_bytes: bytes, crop_hint: str | None = None) -> tuple[str | None, float, str]:
        """(class_key or None, confidence, confidence_status). None when no diagnosis is possible."""
        r = self.predict_detailed(image_bytes, crop_hint)
        return r["key"], r["confidence"], r["confidence_status"]

    def diagnose(self, image_bytes: bytes, crop: str | None = None) -> DiseaseCheckResponse:
        r = self.predict_detailed(image_bytes, crop_hint=crop)
        crop_label = crop or "Unknown crop"

        if r["status"] == "rejected":
            return DiseaseCheckResponse(
                crop=crop_label,
                label="Photo not usable",
                confidence=0.0,
                confidence_status="low",
                advisory_note=(
                    "The photo is too dark, too bright or too plain to assess. Take a close-up of one "
                    "affected leaf in daylight, filling the frame, and try again."
                ),
                status="rejected",
            )
        if r["status"] == "unavailable":
            return DiseaseCheckResponse(
                crop=crop_label,
                label="Diagnosis unavailable",
                confidence=0.0,
                confidence_status="low",
                advisory_note=(
                    "Automatic disease identification is not switched on yet (no trained model is "
                    "installed), so no diagnosis is given. Please show the plant to your nearest "
                    "Krishi Vigyan Kendra (KVK) or agriculture officer."
                ),
                status="unavailable",
            )

        key = metadata_key(r["key"])
        conf, conf_status = r["confidence"], r["confidence_status"]
        meta = DISEASE_METADATA.get(key, {
            "crop": crop_of(r["key"]),
            "display_name": r["key"].replace("___", " ").replace("_", " ").strip(),
            "scientific_name": None,
        })
        effective_crop, display_name = meta["crop"], meta["display_name"]
        healthy = "healthy" in key.lower()

        if conf_status == "high":
            note = (f"The leaf looks healthy ({effective_crop})." if healthy
                    else f"The symptoms match {display_name}. See the verified treatment guidance below.")
        elif conf_status == "moderate":
            note = f"Possibly {display_name}. Confirm with your local KVK before treating."
        else:
            note = (f"Not sure ({conf * 100:.0f}% confidence). Take a clear close-up of the affected leaf in "
                    "daylight, or consult your nearest KVK.")

        treatments: list[DiseaseTreatmentExtract] = []
        if not healthy and conf_status in ("high", "moderate"):
            for c in retrieve(
                query=f"{effective_crop} {display_name} management control",
                crop=effective_crop,
                disease_label=display_name,
                doc_types=["disease_treatment"],
                top_k=3,
            ):
                treatments.append(DiseaseTreatmentExtract(
                    source_title=c.source_title or "Untitled source",
                    page_number=c.page_number,
                    treatment_text=c.chunk_text,
                    similarity=c.similarity,
                ))

        return DiseaseCheckResponse(
            crop=effective_crop,
            label=display_name,
            scientific_name=meta.get("scientific_name"),
            confidence=conf,
            confidence_status=conf_status,
            advisory_note=note,
            treatments=treatments,
            status="model",
            model_version=self.model_version,
            top_k=[
                {**t, "display_name": DISEASE_METADATA.get(metadata_key(t["label"]), {}).get("display_name", t["label"])}
                for t in r["top_k"]
            ],
        )


_detector_instance: DiseaseDetector | None = None


def get_disease_detector() -> DiseaseDetector:
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = DiseaseDetector()
    return _detector_instance
