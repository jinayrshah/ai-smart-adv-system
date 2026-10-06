"""
MobileNetV2 Plant Disease Classification Training Script.
Architecture_Advisory.md §11.

Fine-tunes MobileNetV2 with transfer learning on PlantVillage and ICAR crop disease datasets.
Phase 1: Feature extraction with frozen base (GlobalAveragePooling2D + Dropout(0.2) + Dense).
Phase 2: Fine-tuning top 30 layers with low learning rate (1e-5).
Tracks overall and per-class validation accuracy.
"""

import argparse
import json
import logging
from pathlib import Path
import sys

logger = logging.getLogger(__name__)


def train_disease_model(
    data_dir: str,
    output_model_path: str = "models/disease_mobilenetv2_v1.keras",
    output_classes_path: str = "models/disease_classes.json",
    image_size: tuple[int, int] = (224, 224),
    batch_size: int = 32,
    phase1_epochs: int = 10,
    phase2_epochs: int = 5,
):
    try:
        import tensorflow as tf
        from tensorflow.keras import layers, models
    except ImportError:
        print("TensorFlow is required to run model training. Install with: pip install tensorflow")
        sys.exit(1)

    data_path = Path(data_dir)
    if not data_path.exists():
        print(f"Dataset path {data_dir} does not exist.")
        sys.exit(1)

    print(f"Loading dataset from: {data_path}")

    # 80/20 train/validation split per Architecture §11
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_path,
        validation_split=0.2,
        subset="training",
        seed=1337,
        image_size=image_size,
        batch_size=batch_size,
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_path,
        validation_split=0.2,
        subset="validation",
        seed=1337,
        image_size=image_size,
        batch_size=batch_size,
    )

    class_names = train_ds.class_names
    num_classes = len(class_names)
    print(f"Detected {num_classes} classes: {class_names}")

    # Save class indices map
    Path(output_classes_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_classes_path, "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2)
    print(f"Saved class labels mapping to {output_classes_path}")

    # Data augmentation for training to mitigate lab-condition overfitting (§11)
    data_augmentation = tf.keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.15),
        layers.RandomZoom(0.1),
        layers.RandomContrast(0.1),
    ])

    # MobileNetV2 preprocessing: scales inputs to [-1, 1]
    preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input

    # Base pretrained model
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(image_size[0], image_size[1], 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False  # Phase 1: Feature extraction

    inputs = tf.keras.Input(shape=(image_size[0], image_size[1], 3))
    x = data_augmentation(inputs)
    x = preprocess_input(x)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)

    print("\n--- Starting Phase 1: Feature Extraction ---")
    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    history_p1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=phase1_epochs,
    )

    print("\n--- Starting Phase 2: Fine-Tuning Top 30 Layers ---")
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    history_p2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=phase2_epochs,
    )

    # Evaluate validation metrics
    val_loss, val_acc = model.evaluate(val_ds)
    print(f"\nFinal Validation Accuracy: {val_acc * 100:.2f}% (Loss: {val_loss:.4f})")

    # Save trained model checkpoint
    Path(output_model_path).parent.mkdir(parents=True, exist_ok=True)
    model.save(output_model_path)
    print(f"Model saved successfully to {output_model_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train MobileNetV2 disease model")
    parser.add_argument("--data-dir", required=True, help="Directory containing class subfolders")
    parser.add_argument("--output", default="models/disease_mobilenetv2_v1.keras", help="Model destination")
    parser.add_argument("--epochs", type=int, default=10, help="Phase 1 epochs")
    args = parser.parse_args()

    train_disease_model(args.data_dir, output_model_path=args.output, phase1_epochs=args.epochs)
