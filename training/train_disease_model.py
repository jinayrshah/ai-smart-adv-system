"""
MobileNetV2 plant-disease classifier — training script (Architecture_Advisory.md §11).

Run from the backend directory so outputs land where the API looks for them:

    cd backend
    python ../training/train_disease_model.py --data-dir /path/to/PlantVillage \
        [--field-test-dir /path/to/PlantDoc-style/folder]

Outputs (backend/models/):
    disease_mobilenetv2_v1.keras   the model (includes MobileNetV2 preprocessing: feed raw 0-255 RGB)
    disease_classes.json           class names in the model's output order
    disease_model_meta.json        temperature, preprocessing contract, test / field metrics

What changed vs the first version, and why
- Only the six project crops are trained (README §5 Q1) — PlantVillage has 38 classes,
  most for crops the app never asks about; extra classes only add confusions.
- Separate test split (train/val/test) so the reported accuracy is not the same data
  used for early stopping.
- Stronger augmentation (brightness, translation, zoom, rotation, contrast) and label
  smoothing. Mohanty et al. (2016) report 99.35 % on held-out PlantVillage images but
  31.4 % on images taken under other conditions; PlantVillage's uniform backgrounds are
  a known shortcut, so robustness matters more than the in-distribution number.
- Class weights for imbalanced classes; early stopping on val loss with best weights.
- Fine-tuning keeps BatchNorm layers frozen (Keras transfer-learning guidance) so the
  small learning rate does not wreck the pretrained statistics.
- Temperature scaling (Guo et al. 2017) fitted on the validation split so the
  "high / moderate / low" confidence wording in the app is calibrated; ECE reported.
- Per-class precision/recall, confusion matrix and an optional field-image test set
  are written to disease_model_meta.json so the domain gap is measured, not assumed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.domain.advisory.calibration import (  # noqa: E402
    apply_temperature,
    expected_calibration_error,
    fit_temperature,
)

# PlantVillage folder prefixes for the six project crops (Rice, Wheat and Cotton are not
# in PlantVillage — add field datasets for them under the same "<Crop>___<label>" naming).
DEFAULT_CROP_PREFIXES = ["Tomato", "Corn_(maize)", "Corn", "Soybean", "Rice", "Wheat", "Cotton"]


def _select_classes(data_dir: Path, prefixes: list[str]) -> list[str]:
    names = sorted(p.name for p in data_dir.iterdir() if p.is_dir())
    if not prefixes:
        return names
    keep = [n for n in names if any(n.split("___")[0] == pre or n.startswith(pre + "___") for pre in prefixes)]
    return keep or names


def _class_view(src: Path, keep: list[str]) -> Path:
    """
    image_dataset_from_directory(class_names=...) must match the folder's subdirectories
    exactly, so a subset is exposed through a temporary folder of symlinks.
    """
    present = sorted(p.name for p in src.iterdir() if p.is_dir())
    if present == sorted(keep):
        return src
    view = Path(tempfile.mkdtemp(prefix="disease_classes_"))
    for name in keep:
        os.symlink((src / name).resolve(), view / name, target_is_directory=True)
    return view


IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}


def _split_views(src: Path, classes: list[str], seed: int, fractions=(0.70, 0.15, 0.15)) -> tuple[Path, Path, Path]:
    """
    Deterministic per-class file split into train / val / test symlink folders.
    Splitting at file level avoids take()/skip() on a dataset that reshuffles every
    iteration (which silently mixes validation and test images between passes) and keeps
    every class represented in each split.
    """
    root = Path(tempfile.mkdtemp(prefix="disease_split_"))
    rng = np.random.default_rng(seed)
    views = [root / "train", root / "val", root / "test"]
    for name in classes:
        files = sorted(f for f in (src / name).rglob("*") if f.suffix.lower() in IMAGE_EXT)
        rng.shuffle(files)
        n = len(files)
        n_tr, n_va = int(n * fractions[0]), int(n * fractions[1])
        parts = [files[:n_tr], files[n_tr:n_tr + n_va], files[n_tr + n_va:]]
        for view, part in zip(views, parts):
            (view / name).mkdir(parents=True, exist_ok=True)
            for i, f in enumerate(part):
                os.symlink(f.resolve(), view / name / f"{i:06d}{f.suffix.lower()}")
    return views[0], views[1], views[2]


def _predict(model, ds, index_map: list[int] | None = None):
    probs, labels = [], []
    for x, y in ds:
        probs.append(model.predict(x, verbose=0))
        lab = np.argmax(y.numpy(), axis=1)
        labels.append(np.asarray([index_map[i] for i in lab]) if index_map else lab)
    return np.concatenate(probs), np.concatenate(labels)


def _report(probs: np.ndarray, labels: np.ndarray, class_names: list[str], temperature: float) -> dict:
    cal = apply_temperature(probs, temperature)
    pred = cal.argmax(axis=1)
    n = len(class_names)
    cm = np.zeros((n, n), dtype=int)
    for t, p in zip(labels, pred):
        cm[t, p] += 1
    per_class = {}
    for i, name in enumerate(class_names):
        tp = cm[i, i]
        support = int(cm[i].sum())
        predicted = int(cm[:, i].sum())
        per_class[name] = {
            "precision": round(tp / predicted, 4) if predicted else None,
            "recall": round(tp / support, 4) if support else None,
            "support": support,
        }
    return {
        "accuracy": round(float((pred == labels).mean()), 4),
        "ece_raw": round(expected_calibration_error(probs, labels), 4),
        "ece_calibrated": round(expected_calibration_error(cal, labels), 4),
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "n": int(len(labels)),
    }


def train_disease_model(
    data_dir: str,
    output_dir: str = "models",
    model_name: str = "disease_mobilenetv2_v1.keras",
    crop_prefixes: list[str] | None = None,
    image_size: tuple[int, int] = (224, 224),
    batch_size: int = 32,
    phase1_epochs: int = 12,
    phase2_epochs: int = 8,
    fine_tune_layers: int = 40,
    field_test_dir: str | None = None,
    seed: int = 1337,
):
    try:
        import tensorflow as tf
        from tensorflow.keras import layers
    except ImportError:
        print("TensorFlow is required to train: pip install tensorflow")
        sys.exit(1)

    data_path = Path(data_dir)
    if not data_path.exists():
        print(f"Dataset path {data_dir} does not exist.")
        sys.exit(1)

    class_names = _select_classes(data_path, crop_prefixes if crop_prefixes is not None else DEFAULT_CROP_PREFIXES)
    print(f"Training on {len(class_names)} classes: {class_names}")

    common = dict(
        labels="inferred",
        label_mode="categorical",
        class_names=class_names,
        image_size=image_size,
        batch_size=batch_size,
    )
    train_dir, val_dir, test_dir = _split_views(data_path, class_names, seed)
    train_ds = tf.keras.utils.image_dataset_from_directory(train_dir, shuffle=True, seed=seed, **common)
    val_ds = tf.keras.utils.image_dataset_from_directory(val_dir, shuffle=False, **common)
    test_ds = tf.keras.utils.image_dataset_from_directory(test_dir, shuffle=False, **common)

    # Balanced class weights from the training file counts
    counts = np.array([sum(1 for _ in (train_dir / c).iterdir()) for c in class_names], dtype=float)
    class_weight = {i: float(counts.sum() / (len(counts) * c)) for i, c in enumerate(counts) if c > 0}

    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(autotune)
    val_ds, test_ds = val_ds.prefetch(autotune), test_ds.prefetch(autotune)

    augment = tf.keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.2),
        layers.RandomZoom((-0.15, 0.2)),
        layers.RandomTranslation(0.1, 0.1),
        layers.RandomContrast(0.25),
        layers.RandomBrightness(0.25, value_range=(0, 255)),
    ], name="augment")

    base = tf.keras.applications.MobileNetV2(input_shape=(*image_size, 3), include_top=False, weights="imagenet")
    base.trainable = False

    inputs = tf.keras.Input(shape=(*image_size, 3))  # raw 0-255 RGB
    x = augment(inputs)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base(x, training=False)  # keep BatchNorm in inference mode, also when fine-tuning
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(len(class_names), activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)

    loss = tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1)
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.3, patience=2, min_lr=1e-7),
    ]

    print("\n--- Phase 1: train the classifier head ---")
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss=loss, metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=phase1_epochs, class_weight=class_weight, callbacks=callbacks)

    print(f"\n--- Phase 2: fine-tune the top {fine_tune_layers} layers (BatchNorm frozen) ---")
    base.trainable = True
    for layer in base.layers[:-fine_tune_layers]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, layers.BatchNormalization):
            layer.trainable = False
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss=loss, metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=phase2_epochs, class_weight=class_weight, callbacks=callbacks)

    # Calibrate on validation, report on test (and optional field images)
    val_probs, val_labels = _predict(model, val_ds)
    temperature = fit_temperature(val_probs, val_labels)
    test_probs, test_labels = _predict(model, test_ds)
    meta: dict = {
        "classes": class_names,
        "temperature": temperature,
        "image_size": list(image_size),
        "preprocessing": "model_includes_mobilenet_v2_preprocess",  # feed raw 0-255 RGB
        "test": _report(test_probs, test_labels, class_names, temperature),
    }
    print(f"\nTest accuracy {meta['test']['accuracy']:.2%} | T={temperature} | "
          f"ECE {meta['test']['ece_raw']:.3f} -> {meta['test']['ece_calibrated']:.3f}")

    if field_test_dir:
        fdir = Path(field_test_dir)
        field_classes = [c for c in class_names if (fdir / c).is_dir()]
        if field_classes:
            field_ds = tf.keras.utils.image_dataset_from_directory(
                _class_view(fdir, field_classes), labels="inferred", label_mode="categorical",
                class_names=field_classes, image_size=image_size, batch_size=batch_size, shuffle=False,
            )
            # field labels are indices into field_classes; map them to the model's output order
            fp, fl = _predict(model, field_ds, index_map=[class_names.index(c) for c in field_classes])
            meta["field_test"] = _report(fp, fl, class_names, temperature)
            meta["field_test"]["classes_evaluated"] = field_classes
        else:
            print(f"No class folders in {fdir} match the trained classes; field test skipped.")
            meta["field_test"] = None
        if meta.get("field_test"):
            print(f"Field-image accuracy {meta['field_test']['accuracy']:.2%} (domain-gap check)")

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    model.save(out / model_name)
    (out / "disease_classes.json").write_text(json.dumps(class_names, indent=2), encoding="utf-8")
    (out / "disease_model_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Saved model, classes and metadata to {out.resolve()}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Train the MobileNetV2 disease model")
    ap.add_argument("--data-dir", required=True, help="Folder of <Crop>___<label> class subfolders")
    ap.add_argument("--output-dir", default="models")
    ap.add_argument("--field-test-dir", default=None, help="Optional field-photo folder with the same class names")
    ap.add_argument("--all-classes", action="store_true", help="Train on every class folder, not just the 6 crops")
    ap.add_argument("--epochs", type=int, default=12, help="Phase 1 epochs")
    ap.add_argument("--fine-tune-epochs", type=int, default=8)
    args = ap.parse_args()
    train_disease_model(
        args.data_dir,
        output_dir=args.output_dir,
        crop_prefixes=[] if args.all_classes else None,
        phase1_epochs=args.epochs,
        phase2_epochs=args.fine_tune_epochs,
        field_test_dir=args.field_test_dir,
    )
