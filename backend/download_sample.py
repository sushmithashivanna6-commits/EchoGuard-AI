from datasets import load_dataset
import os

print("======================================")
print(" AI VOICE GUARD - DATASET DOWNLOADER")
print("======================================")

# Dataset
DATASET_NAME = "SpeechAntiSpoofingBenchmarks/ASVspoof2021_DF"

# Number of NEW samples to add
TARGET_PER_CLASS = 200

HUMAN_DIR = "dataset/human"
AI_DIR = "dataset/ai"

os.makedirs(HUMAN_DIR, exist_ok=True)
os.makedirs(AI_DIR, exist_ok=True)

print("\nLoading dataset...")
print("This may take some time.\n")

dataset = load_dataset(
    DATASET_NAME,
    split="test"
)

print("Dataset loaded successfully!")
print("Total available samples:", len(dataset))

# Count existing files
existing_human = len([
    f for f in os.listdir(HUMAN_DIR)
    if f.endswith(".flac")
])

existing_ai = len([
    f for f in os.listdir(AI_DIR)
    if f.endswith(".flac")
])

print("\nExisting samples:")
print("Human:", existing_human)
print("AI/Spoof:", existing_ai)

human_count = existing_human
ai_count = existing_ai

print("\nAdding samples...")

for i, sample in enumerate(dataset):

    if human_count >= TARGET_PER_CLASS and ai_count >= TARGET_PER_CLASS:
        break

    label = sample["label"]

    audio_info = sample["audio"]

    audio_bytes = audio_info["bytes"]

    # ASVspoof labels:
    # 0 = bonafide / human
    # 1 = spoof / AI
    if label == 0 and human_count < TARGET_PER_CLASS:

        filename = os.path.join(
            HUMAN_DIR,
            f"human_{human_count + 1:04d}.flac"
        )

        with open(filename, "wb") as f:
            f.write(audio_bytes)

        human_count += 1

        print(
            f"Human sample saved: "
            f"{human_count}/{TARGET_PER_CLASS}"
        )

    elif label == 1 and ai_count < TARGET_PER_CLASS:

        filename = os.path.join(
            AI_DIR,
            f"ai_{ai_count + 1:04d}.flac"
        )

        with open(filename, "wb") as f:
            f.write(audio_bytes)

        ai_count += 1

        print(
            f"AI sample saved: "
            f"{ai_count}/{TARGET_PER_CLASS}"
        )

print("\n======================================")
print(" DOWNLOAD COMPLETE")
print("======================================")

print("Human samples:", human_count)
print("AI/Spoof samples:", ai_count)

print("\nDataset location:")
print("dataset/human")
print("dataset/ai")