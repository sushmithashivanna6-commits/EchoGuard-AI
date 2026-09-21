import os
import librosa
import numpy as np
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

DATASET_PATH = "dataset"
MODEL_PATH = "voice_detector.pkl"

SAMPLE_RATE = 16000


# --------------------------------------------------
# FEATURE EXTRACTION
# --------------------------------------------------

def extract_features(file_path):
    """
    Extract multiple audio features from one audio file.
    """

    try:
        # Load audio
        audio, sr = librosa.load(
            file_path,
            sr=SAMPLE_RATE,
            mono=True
        )

        # Remove very small/silent audio
        if len(audio) < 1000:
            return None

        features = []

        # ------------------------------------------
        # 1. MFCC
        # ------------------------------------------

        mfcc = librosa.feature.mfcc(
            y=audio,
            sr=sr,
            n_mfcc=40
        )

        # Mean
        features.extend(np.mean(mfcc, axis=1))

        # Standard deviation
        features.extend(np.std(mfcc, axis=1))

        # ------------------------------------------
        # 2. Spectral Centroid
        # ------------------------------------------

        spectral_centroid = librosa.feature.spectral_centroid(
            y=audio,
            sr=sr
        )

        features.append(np.mean(spectral_centroid))
        features.append(np.std(spectral_centroid))

        # ------------------------------------------
        # 3. Spectral Bandwidth
        # ------------------------------------------

        spectral_bandwidth = librosa.feature.spectral_bandwidth(
            y=audio,
            sr=sr
        )

        features.append(np.mean(spectral_bandwidth))
        features.append(np.std(spectral_bandwidth))

        # ------------------------------------------
        # 4. Spectral Rolloff
        # ------------------------------------------

        spectral_rolloff = librosa.feature.spectral_rolloff(
            y=audio,
            sr=sr
        )

        features.append(np.mean(spectral_rolloff))
        features.append(np.std(spectral_rolloff))

        # ------------------------------------------
        # 5. Zero Crossing Rate
        # ------------------------------------------

        zero_crossing_rate = librosa.feature.zero_crossing_rate(
            audio
        )

        features.append(np.mean(zero_crossing_rate))
        features.append(np.std(zero_crossing_rate))

        # ------------------------------------------
        # 6. RMS Energy
        # ------------------------------------------

        rms = librosa.feature.rms(
            y=audio
        )

        features.append(np.mean(rms))
        features.append(np.std(rms))

        return np.array(features, dtype=np.float32)

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None


# --------------------------------------------------
# LOAD DATASET
# --------------------------------------------------

X = []
y = []

print("\n======================================")
print(" AI VOICE GUARD - MODEL TRAINING")
print("======================================\n")


# --------------------------------------------------
# HUMAN VOICES
# Label = 0
# --------------------------------------------------

human_folder = os.path.join(DATASET_PATH, "human")

print("Loading HUMAN voice samples...")

human_count = 0

if os.path.exists(human_folder):

    for filename in os.listdir(human_folder):

        file_path = os.path.join(
            human_folder,
            filename
        )

        if filename.lower().endswith(
            (".wav", ".flac", ".mp3", ".m4a", ".webm")
        ):

            features = extract_features(file_path)

            if features is not None:

                X.append(features)
                y.append(0)

                human_count += 1

print(f"Human samples loaded: {human_count}")


# --------------------------------------------------
# AI / SPOOF VOICES
# Label = 1
# --------------------------------------------------

ai_folder = os.path.join(DATASET_PATH, "ai")

print("\nLoading AI/SPOOF voice samples...")

ai_count = 0

if os.path.exists(ai_folder):

    for filename in os.listdir(ai_folder):

        file_path = os.path.join(
            ai_folder,
            filename
        )

        if filename.lower().endswith(
            (".wav", ".flac", ".mp3", ".m4a", ".webm")
        ):

            features = extract_features(file_path)

            if features is not None:

                X.append(features)
                y.append(1)

                ai_count += 1

print(f"AI/Spoof samples loaded: {ai_count}")


# --------------------------------------------------
# CHECK DATASET
# --------------------------------------------------

X = np.array(X)
y = np.array(y)

print("\n======================================")
print("DATASET SUMMARY")
print("======================================")

print(f"Total samples : {len(X)}")
print(f"Human samples : {human_count}")
print(f"AI samples    : {ai_count}")
print(f"Features/sample: {X.shape[1] if len(X) > 0 else 0}")


if len(X) < 10:

    print("\n❌ Not enough audio files to train the model.")
    print("Add more files to:")
    print("dataset/human")
    print("dataset/ai")

    exit()


if human_count < 2 or ai_count < 2:

    print("\n❌ Both classes need at least 2 samples.")

    exit()


# --------------------------------------------------
# TRAIN / TEST SPLIT
# --------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


print("\n======================================")
print("TRAINING MODEL")
print("======================================\n")


# --------------------------------------------------
# RANDOM FOREST
# --------------------------------------------------

model = RandomForestClassifier(
    n_estimators=300,
    max_depth=None,
    random_state=42,
    class_weight="balanced",
    n_jobs=-1
)


model.fit(X_train, y_train)


# --------------------------------------------------
# TEST MODEL
# --------------------------------------------------

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)


print("\n======================================")
print("MODEL RESULTS")
print("======================================")

print(f"\nAccuracy: {accuracy * 100:.2f}%\n")

print("Classification Report:")
print(
    classification_report(
        y_test,
        predictions,
        target_names=[
            "Human Voice",
            "AI / Spoof Voice"
        ],
        zero_division=0
    )
)


print("Confusion Matrix:")
print(confusion_matrix(y_test, predictions))


# --------------------------------------------------
# SAVE MODEL
# --------------------------------------------------

joblib.dump(
    model,
    MODEL_PATH
)


print("\n======================================")
print("MODEL SAVED SUCCESSFULLY")
print("======================================")

print(f"\nSaved as: {MODEL_PATH}")

print("\nNext step:")
print("Update main.py so it uses the same feature extraction.")