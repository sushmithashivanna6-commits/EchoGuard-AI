from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import librosa
import numpy as np
import joblib
import os
import subprocess
import uuid


# ============================================================
# VOXSHIELD AI - BACKEND
# SIH26104: AI-Powered Real-Time Detection and Prevention
# of Voice Cloning Impersonation Attacks
# ============================================================

app = FastAPI(
    title="VoxShield AI API",
    description="AI-powered voice spoof and impersonation risk detection",
    version="1.1.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# LOAD ML MODEL
# ============================================================

MODEL_PATH = "voice_detector.pkl"

try:
    model = joblib.load(MODEL_PATH)

    print("======================================")
    print("VOXSHIELD AI")
    print("Voice detection model loaded successfully!")
    print("======================================")

except Exception as e:

    model = None

    print("======================================")
    print("Could not load voice_detector.pkl")
    print("Error:", e)
    print("======================================")


# ============================================================
# FFMPEG PATH
# ============================================================

FFMPEG_PATH = (
    r"C:\Users\Sushmitha\AppData\Local\Microsoft\WinGet\Packages"
    r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
    r"\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
)


# ============================================================
# BASIC AUDIO VALIDATION
# ============================================================

MAX_FILE_SIZE = 50 * 1024 * 1024


# ============================================================
# SPEAKER REFERENCE STORAGE
#
# A trusted reference voice fingerprint is stored locally.
#
# This is ONLY a prototype.
# It does not store the original voice recording.
# ============================================================

REFERENCE_DIR = "speaker_reference"
REFERENCE_FINGERPRINT_PATH = os.path.join(
    REFERENCE_DIR,
    "reference_fingerprint.npy"
)

os.makedirs(
    REFERENCE_DIR,
    exist_ok=True
)


# ============================================================
# 90-FEATURE EXTRACTION
#
# IMPORTANT:
# This remains compatible with the existing Random Forest.
#
# 40 MFCC means
# 40 MFCC standard deviations
# 10 spectral/audio statistics
#
# TOTAL = 90 FEATURES
# ============================================================

def extract_features(file_path):

    print("🎵 Extracting 90 ML features...")

    y, sr = librosa.load(
        file_path,
        sr=16000,
        mono=True
    )

    if len(y) == 0:
        raise ValueError(
            "Audio file contains no usable audio data."
        )

    # --------------------------------------------------------
    # MFCC
    # --------------------------------------------------------

    mfcc = librosa.feature.mfcc(
        y=y,
        sr=sr,
        n_mfcc=40
    )

    mfcc_mean = np.mean(
        mfcc,
        axis=1
    )

    mfcc_std = np.std(
        mfcc,
        axis=1
    )

    # --------------------------------------------------------
    # SPECTRAL CENTROID
    # --------------------------------------------------------

    spectral_centroid = librosa.feature.spectral_centroid(
        y=y,
        sr=sr
    )

    centroid_mean = np.mean(
        spectral_centroid
    )

    centroid_std = np.std(
        spectral_centroid
    )

    # --------------------------------------------------------
    # SPECTRAL BANDWIDTH
    # --------------------------------------------------------

    spectral_bandwidth = librosa.feature.spectral_bandwidth(
        y=y,
        sr=sr
    )

    bandwidth_mean = np.mean(
        spectral_bandwidth
    )

    bandwidth_std = np.std(
        spectral_bandwidth
    )

    # --------------------------------------------------------
    # SPECTRAL ROLLOFF
    # --------------------------------------------------------

    spectral_rolloff = librosa.feature.spectral_rolloff(
        y=y,
        sr=sr
    )

    rolloff_mean = np.mean(
        spectral_rolloff
    )

    rolloff_std = np.std(
        spectral_rolloff
    )

    # --------------------------------------------------------
    # ZERO CROSSING RATE
    # --------------------------------------------------------

    zero_crossing_rate = librosa.feature.zero_crossing_rate(
        y
    )

    zcr_mean = np.mean(
        zero_crossing_rate
    )

    zcr_std = np.std(
        zero_crossing_rate
    )

    # --------------------------------------------------------
    # RMS ENERGY
    # --------------------------------------------------------

    rms = librosa.feature.rms(
        y=y
    )

    rms_mean = np.mean(
        rms
    )

    rms_std = np.std(
        rms
    )

    # --------------------------------------------------------
    # COMBINE 90 FEATURES
    # --------------------------------------------------------

    features = np.concatenate([
        mfcc_mean,
        mfcc_std,
        [
            centroid_mean,
            centroid_std,
            bandwidth_mean,
            bandwidth_std,
            rolloff_mean,
            rolloff_std,
            zcr_mean,
            zcr_std,
            rms_mean,
            rms_std
        ]
    ])

    print(
        "📊 ML feature count:",
        len(features)
    )

    if len(features) != 90:

        raise ValueError(
            f"Expected 90 ML features but extracted {len(features)}."
        )

    return features.reshape(
        1,
        -1
    )


# ============================================================
# SPEAKER FINGERPRINT
#
# This fingerprint is separate from the 90-feature ML vector.
#
# It is used only for prototype speaker consistency analysis.
# ============================================================

def extract_speaker_fingerprint(file_path):

    print("👤 Creating speaker fingerprint...")

    y, sr = librosa.load(
        file_path,
        sr=16000,
        mono=True
    )

    if len(y) == 0:
        raise ValueError(
            "Audio contains no usable speech."
        )

    # ========================================================
    # MFCC STATISTICS
    # ========================================================

    mfcc = librosa.feature.mfcc(
        y=y,
        sr=sr,
        n_mfcc=20
    )

    mfcc_mean = np.mean(
        mfcc,
        axis=1
    )

    mfcc_std = np.std(
        mfcc,
        axis=1
    )

    # ========================================================
    # MEL-SPECTRAL INFORMATION
    # ========================================================

    mel = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_mels=20
    )

    mel_db = librosa.power_to_db(
        mel,
        ref=np.max
    )

    mel_mean = np.mean(
        mel_db,
        axis=1
    )

    # ========================================================
    # PITCH
    # ========================================================

    pitch_mean = 0.0
    pitch_std = 0.0
    pitch_median = 0.0
    voiced_ratio = 0.0

    try:

        f0, voiced_flag, voiced_prob = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr
        )

        valid_pitch = f0[
            ~np.isnan(f0)
        ]

        if len(valid_pitch) > 0:

            pitch_mean = float(
                np.mean(valid_pitch)
            )

            pitch_std = float(
                np.std(valid_pitch)
            )

            pitch_median = float(
                np.median(valid_pitch)
            )

            voiced_ratio = float(
                len(valid_pitch) / len(f0)
            )

    except Exception as pitch_error:

        print(
            "⚠️ Speaker pitch analysis unavailable:",
            pitch_error
        )

    # ========================================================
    # ENERGY
    # ========================================================

    rms = librosa.feature.rms(
        y=y
    )[0]

    rms_mean = float(
        np.mean(rms)
    )

    rms_std = float(
        np.std(rms)
    )

    # ========================================================
    # SPECTRAL CHARACTERISTICS
    # ========================================================

    centroid = librosa.feature.spectral_centroid(
        y=y,
        sr=sr
    )[0]

    bandwidth = librosa.feature.spectral_bandwidth(
        y=y,
        sr=sr
    )[0]

    zcr = librosa.feature.zero_crossing_rate(
        y
    )[0]

    spectral_centroid_mean = float(
        np.mean(centroid)
    )

    spectral_centroid_std = float(
        np.std(centroid)
    )

    spectral_bandwidth_mean = float(
        np.mean(bandwidth)
    )

    spectral_bandwidth_std = float(
        np.std(bandwidth)
    )

    zcr_mean = float(
        np.mean(zcr)
    )

    zcr_std = float(
        np.std(zcr)
    )

    # ========================================================
    # FINAL SPEAKER FINGERPRINT
    # ========================================================

    fingerprint = np.concatenate([
        mfcc_mean,
        mfcc_std,
        mel_mean,
        [
            pitch_mean,
            pitch_std,
            pitch_median,
            voiced_ratio,
            rms_mean,
            rms_std,
            spectral_centroid_mean,
            spectral_centroid_std,
            spectral_bandwidth_mean,
            spectral_bandwidth_std,
            zcr_mean,
            zcr_std
        ]
    ])

    fingerprint = np.nan_to_num(
        fingerprint,
        nan=0.0,
        posinf=0.0,
        neginf=0.0
    )

    print(
        "👤 Speaker fingerprint size:",
        len(fingerprint)
    )

    return fingerprint


# ============================================================
# NORMALIZE FINGERPRINT
# ============================================================

def normalize_fingerprint(fingerprint):

    fingerprint = np.asarray(
        fingerprint,
        dtype=np.float64
    )

    norm = np.linalg.norm(
        fingerprint
    )

    if norm == 0:

        return fingerprint

    return fingerprint / norm


# ============================================================
# SPEAKER SIMILARITY
#
# Cosine similarity is converted to a 0-100 prototype score.
# ============================================================

def calculate_speaker_similarity(
    reference_fingerprint,
    current_fingerprint
):

    reference = normalize_fingerprint(
        reference_fingerprint
    )

    current = normalize_fingerprint(
        current_fingerprint
    )

    similarity = float(
        np.dot(
            reference,
            current
        )
    )

    # Convert cosine similarity range
    # approximately [-1, 1]
    # into a 0-100 score.

    similarity_score = (
        (similarity + 1.0) / 2.0
    ) * 100.0

    similarity_score = max(
        0.0,
        min(
            similarity_score,
            100.0
        )
    )

    return round(
        similarity_score,
        2
    )


# ============================================================
# SPEAKER CONSISTENCY ANALYSIS
# ============================================================

def analyze_speaker_consistency(
    file_path
):

    # --------------------------------------------------------
    # No reference speaker registered
    # --------------------------------------------------------

    if not os.path.exists(
        REFERENCE_FINGERPRINT_PATH
    ):

        return {
            "reference_registered": False,
            "speaker_match_score": None,
            "speaker_status": "NO_REFERENCE",
            "speaker_consistency": "NOT_AVAILABLE",
            "message": (
                "No trusted reference speaker has been registered."
            )
        }

    try:

        reference_fingerprint = np.load(
            REFERENCE_FINGERPRINT_PATH
        )

        current_fingerprint = (
            extract_speaker_fingerprint(
                file_path
            )
        )

        match_score = calculate_speaker_similarity(
            reference_fingerprint,
            current_fingerprint
        )

        # ====================================================
        # PROTOTYPE THRESHOLDS
        # ====================================================

        if match_score >= 75:

            speaker_status = "MATCH"

            speaker_consistency = "HIGH"

            message = (
                "The voice shows strong similarity "
                "to the registered reference speaker."
            )

        elif match_score >= 55:

            speaker_status = "UNCERTAIN"

            speaker_consistency = "MEDIUM"

            message = (
                "The voice has moderate similarity "
                "to the registered reference speaker. "
                "Additional verification is recommended."
            )

        else:

            speaker_status = "ANOMALY"

            speaker_consistency = "LOW"

            message = (
                "The voice shows low similarity "
                "to the registered reference speaker. "
                "Possible speaker impersonation anomaly."
            )

        return {

            "reference_registered": True,

            "speaker_match_score": match_score,

            "speaker_status": speaker_status,

            "speaker_consistency": speaker_consistency,

            "message": message

        }

    except Exception as e:

        print(
            "⚠️ Speaker consistency error:",
            str(e)
        )

        return {

            "reference_registered": True,

            "speaker_match_score": None,

            "speaker_status": "ERROR",

            "speaker_consistency": "UNKNOWN",

            "message": (
                "Speaker comparison could not be completed."
            )

        }


# ============================================================
# ADDITIONAL AUDIO SECURITY ANALYSIS
# ============================================================

def analyze_audio_behavior(file_path):

    print(
        "🔍 Running additional audio security analysis..."
    )

    y, sr = librosa.load(
        file_path,
        sr=16000,
        mono=True
    )

    if len(y) == 0:

        raise ValueError(
            "Unable to analyze audio."
        )

    # ========================================================
    # DURATION
    # ========================================================

    duration = float(
        librosa.get_duration(
            y=y,
            sr=sr
        )
    )

    # ========================================================
    # RMS ENERGY
    # ========================================================

    rms = librosa.feature.rms(
        y=y
    )[0]

    rms_mean = float(
        np.mean(rms)
    )

    rms_std = float(
        np.std(rms)
    )

    # ========================================================
    # SILENCE / VOICE ACTIVITY
    # ========================================================

    non_silent_intervals = librosa.effects.split(
        y,
        top_db=30
    )

    if len(non_silent_intervals) > 0:

        speech_samples = sum(
            end - start
            for start, end in non_silent_intervals
        )

        speech_ratio = float(
            speech_samples / len(y)
        )

    else:

        speech_ratio = 0.0

    silence_ratio = float(
        1.0 - speech_ratio
    )

    # ========================================================
    # ZERO CROSSING VARIATION
    # ========================================================

    zcr = librosa.feature.zero_crossing_rate(
        y
    )[0]

    zcr_mean = float(
        np.mean(zcr)
    )

    zcr_std = float(
        np.std(zcr)
    )

    # ========================================================
    # PITCH / F0 ANALYSIS
    # ========================================================

    pitch_mean = 0.0
    pitch_std = 0.0
    voiced_ratio = 0.0

    try:

        f0, voiced_flag, voiced_prob = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr
        )

        valid_pitch = f0[
            ~np.isnan(f0)
        ]

        if len(valid_pitch) > 0:

            pitch_mean = float(
                np.mean(valid_pitch)
            )

            pitch_std = float(
                np.std(valid_pitch)
            )

        voiced_ratio = float(
            np.mean(
                ~np.isnan(f0)
            )
        )

    except Exception as pitch_error:

        print(
            "⚠️ Pitch analysis unavailable:",
            pitch_error
        )

    # ========================================================
    # ENERGY VARIATION
    # ========================================================

    energy_variation = 0.0

    if rms_mean > 0:

        energy_variation = float(
            rms_std / rms_mean
        )

    # ========================================================
    # BASIC PROSODY INDICATOR
    # ========================================================

    pitch_variation_score = 0.0

    if pitch_mean > 0:

        pitch_variation_score = float(
            pitch_std / pitch_mean
        )

    # ========================================================
    # SPEECH ACTIVITY SCORE
    # ========================================================

    if speech_ratio >= 0.70:

        speech_activity = "HIGH"

    elif speech_ratio >= 0.40:

        speech_activity = "MEDIUM"

    else:

        speech_activity = "LOW"

    # ========================================================
    # RETURN
    # ========================================================

    analysis = {

        "duration_seconds": round(
            duration,
            2
        ),

        "speech_ratio": round(
            speech_ratio * 100,
            2
        ),

        "silence_ratio": round(
            silence_ratio * 100,
            2
        ),

        "rms_mean": round(
            rms_mean,
            6
        ),

        "energy_variation": round(
            energy_variation,
            4
        ),

        "zcr_mean": round(
            zcr_mean,
            6
        ),

        "zcr_variation": round(
            zcr_std,
            6
        ),

        "pitch_mean_hz": round(
            pitch_mean,
            2
        ),

        "pitch_variation": round(
            pitch_variation_score,
            4
        ),

        "voiced_ratio": round(
            voiced_ratio * 100,
            2
        ),

        "speech_activity": speech_activity

    }

    print(
        "📡 Supporting audio signals:"
    )

    for key, value in analysis.items():

        print(
            f"   {key}: {value}"
        )

    return analysis


# ============================================================
# DYNAMIC RISK ENGINE
# ============================================================

def calculate_security_risk(
    prediction,
    confidence,
    audio_analysis,
    speaker_analysis=None
):

    # ========================================================
    # AI / SPOOF CASE
    # ========================================================

    if prediction == 1:

        risk_score = float(
            confidence
        )

        risk_reasons = []

        # ----------------------------------------------------
        # Strong ML detection
        # ----------------------------------------------------

        if confidence >= 80:

            risk_reasons.append(
                "The ML model detected a high probability "
                "of synthetic or spoofed speech."
            )

        elif confidence >= 60:

            risk_reasons.append(
                "The ML model detected suspicious "
                "voice characteristics."
            )

        # ----------------------------------------------------
        # Pitch behaviour
        # ----------------------------------------------------

        pitch_variation = audio_analysis.get(
            "pitch_variation",
            0
        )

        if (
            audio_analysis.get(
                "pitch_mean_hz",
                0
            ) > 0
            and pitch_variation < 0.08
        ):

            risk_score += 5

            risk_reasons.append(
                "Pitch variation is relatively limited."
            )

        # ----------------------------------------------------
        # Energy behaviour
        # ----------------------------------------------------

        energy_variation = audio_analysis.get(
            "energy_variation",
            0
        )

        if energy_variation < 0.08:

            risk_score += 4

            risk_reasons.append(
                "Energy variation is relatively low."
            )

        # ----------------------------------------------------
        # Excessive silence
        # ----------------------------------------------------

        silence_ratio = audio_analysis.get(
            "silence_ratio",
            0
        )

        if silence_ratio > 55:

            risk_score += 3

            risk_reasons.append(
                "The recording contains a high amount "
                "of estimated silence."
            )

        # ----------------------------------------------------
        # SPEAKER ANOMALY
        # ----------------------------------------------------

        if speaker_analysis:

            speaker_status = speaker_analysis.get(
                "speaker_status"
            )

            speaker_match_score = speaker_analysis.get(
                "speaker_match_score"
            )

            if speaker_status == "ANOMALY":

                risk_score += 10

                risk_reasons.append(
                    "The detected speaker differs significantly "
                    "from the registered reference speaker."
                )

            elif speaker_status == "UNCERTAIN":

                risk_score += 5

                risk_reasons.append(
                    "Speaker identity consistency is uncertain."
                )

            if speaker_match_score is not None:

                print(
                    "👤 Speaker match:",
                    speaker_match_score,
                    "%"
                )

        # ----------------------------------------------------
        # LIMIT
        # ----------------------------------------------------

        risk_score = min(
            risk_score,
            100
        )

        # ----------------------------------------------------
        # RISK LEVEL
        # ----------------------------------------------------

        if risk_score >= 80:

            risk_level = "HIGH"

        elif risk_score >= 60:

            risk_level = "MEDIUM"

        else:

            risk_level = "UNCERTAIN"

        return (
            round(
                risk_score,
                2
            ),
            risk_level,
            risk_reasons
        )

    # ========================================================
    # HUMAN CASE
    # ========================================================

    else:

        risk_score = max(
            0,
            100 - confidence
        )

        risk_reasons = []

        if confidence >= 80:

            risk_level = "LOW"

            risk_reasons.append(
                "The ML model found characteristics "
                "consistent with human speech."
            )

        else:

            risk_level = "UNCERTAIN"

            risk_reasons.append(
                "The model classified the recording as "
                "human but confidence is not sufficiently high."
            )

        # ----------------------------------------------------
        # Speaker anomaly can still increase risk
        # ----------------------------------------------------

        if speaker_analysis:

            speaker_status = speaker_analysis.get(
                "speaker_status"
            )

            if speaker_status == "ANOMALY":

                risk_score += 10

                risk_level = "MEDIUM"

                risk_reasons.append(
                    "The voice appears human but does not "
                    "closely match the registered speaker."
                )

            elif speaker_status == "UNCERTAIN":

                risk_score += 5

                risk_reasons.append(
                    "Speaker identity consistency is uncertain."
                )

        risk_score = min(
            risk_score,
            100
        )

        return (
            round(
                risk_score,
                2
            ),
            risk_level,
            risk_reasons
        )


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def home():

    return {

        "message":
            "VoxShield AI Backend is running!",

        "system":
            "AI Voice Impersonation Detection",

        "problem_statement":
            "SIH26104",

        "version":
            "1.1",

        "status":
            "online"

    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {

        "status":
            "healthy",

        "model_loaded":
            model is not None,

        "reference_speaker_registered":
            os.path.exists(
                REFERENCE_FINGERPRINT_PATH
            ),

        "system":
            "VoxShield AI"

    }


# ============================================================
# SPEAKER REFERENCE STATUS
# ============================================================

@app.get("/speaker/status")
def speaker_status():

    registered = os.path.exists(
        REFERENCE_FINGERPRINT_PATH
    )

    return {

        "reference_registered":
            registered,

        "speaker_system":
            "Prototype speaker consistency",

        "message":
            (
                "A trusted reference speaker is registered."
                if registered
                else
                "No trusted reference speaker is registered yet."
            )

    }


# ============================================================
# REGISTER TRUSTED SPEAKER
#
# This endpoint accepts a trusted reference recording.
#
# The original audio is temporary and deleted.
# Only the fingerprint is retained.
# ============================================================

@app.post("/speaker/register")
async def register_speaker(
    file: UploadFile = File(...)
):

    audio_data = await file.read()

    if len(audio_data) == 0:

        return {

            "status":
                "Registration Failed",

            "message":
                "The uploaded reference voice is empty."

        }

    if len(audio_data) > MAX_FILE_SIZE:

        return {

            "status":
                "Registration Failed",

            "message":
                "Reference audio is larger than 50 MB."

        }

    unique_id = str(
        uuid.uuid4()
    )

    extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if not extension:

        extension = ".webm"

    input_filename = (
        f"reference_temp_{unique_id}{extension}"
    )

    wav_filename = (
        f"reference_converted_{unique_id}.wav"
    )

    try:

        with open(
            input_filename,
            "wb"
        ) as f:

            f.write(
                audio_data
            )

        print("")
        print("======================================")
        print("👤 REGISTERING TRUSTED SPEAKER")
        print("======================================")

        # ----------------------------------------------------
        # CONVERT
        # ----------------------------------------------------

        command = [

            FFMPEG_PATH,

            "-y",

            "-i",

            input_filename,

            "-ar",

            "16000",

            "-ac",

            "1",

            wav_filename

        ]

        subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )

        # ----------------------------------------------------
        # CREATE FINGERPRINT
        # ----------------------------------------------------

        fingerprint = (
            extract_speaker_fingerprint(
                wav_filename
            )
        )

        # ----------------------------------------------------
        # SAVE ONLY FINGERPRINT
        # ----------------------------------------------------

        np.save(
            REFERENCE_FINGERPRINT_PATH,
            fingerprint
        )

        print(
            "✅ Trusted speaker fingerprint registered."
        )

        return {

            "status":
                "Speaker Registered",

            "message":
                (
                    "Trusted reference speaker registered successfully."
                ),

            "fingerprint_size":
                int(
                    len(fingerprint)
                ),

            "audio_retention":
                "Temporary audio deleted after fingerprint creation."

        }

    except subprocess.CalledProcessError:

        return {

            "status":
                "Registration Failed",

            "message":
                "FFmpeg could not process the reference audio."

        }

    except Exception as e:

        print(
            "❌ Speaker registration error:",
            str(e)
        )

        return {

            "status":
                "Registration Failed",

            "message":
                str(e)

        }

    finally:

        if os.path.exists(
            input_filename
        ):

            os.remove(
                input_filename
            )

        if os.path.exists(
            wav_filename
        ):

            os.remove(
                wav_filename
            )


# ============================================================
# SPEAKER COMPARE ENDPOINT
# ============================================================

@app.post("/speaker/compare")
async def compare_speaker(
    file: UploadFile = File(...)
):

    if not os.path.exists(
        REFERENCE_FINGERPRINT_PATH
    ):

        return {

            "status":
                "No Reference",

            "reference_registered":
                False,

            "speaker_match_score":
                None,

            "speaker_status":
                "NO_REFERENCE",

            "speaker_consistency":
                "NOT_AVAILABLE",

            "message":
                (
                    "Register a trusted reference speaker first."
                )

        }

    audio_data = await file.read()

    if len(audio_data) == 0:

        return {

            "status":
                "Comparison Failed",

            "message":
                "Audio file is empty."

        }

    unique_id = str(
        uuid.uuid4()
    )

    extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if not extension:

        extension = ".webm"

    input_filename = (
        f"speaker_temp_{unique_id}{extension}"
    )

    wav_filename = (
        f"speaker_converted_{unique_id}.wav"
    )

    try:

        with open(
            input_filename,
            "wb"
        ) as f:

            f.write(
                audio_data
            )

        command = [

            FFMPEG_PATH,

            "-y",

            "-i",

            input_filename,

            "-ar",

            "16000",

            "-ac",

            "1",

            wav_filename

        ]

        subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )

        result = analyze_speaker_consistency(
            wav_filename
        )

        return {

            "status":
                "Speaker Analysis Complete",

            **result

        }

    except subprocess.CalledProcessError:

        return {

            "status":
                "Comparison Failed",

            "message":
                "FFmpeg could not process the audio."

        }

    except Exception as e:

        return {

            "status":
                "Comparison Failed",

            "message":
                str(e)

        }

    finally:

        if os.path.exists(
            input_filename
        ):

            os.remove(
                input_filename
            )

        if os.path.exists(
            wav_filename
        ):

            os.remove(
                wav_filename
            )


# ============================================================
# VOICE DETECTION ENDPOINT
# ============================================================

@app.post("/detect")
async def detect_voice(
    file: UploadFile = File(...)
):

    # ========================================================
    # MODEL CHECK
    # ========================================================

    if model is None:

        return {

            "status":
                "Analysis Failed",

            "prediction":
                None,

            "confidence":
                0,

            "risk_level":
                "UNKNOWN",

            "risk_score":
                0,

            "risk_description":
                "The voice detection model could not be loaded.",

            "filename":
                file.filename,

            "message":
                "Voice detection model could not be loaded.",

            "recommendations": [

                "Restart the backend server.",

                "Check that voice_detector.pkl exists."

            ]

        }

    # ========================================================
    # FILE SIZE CHECK
    # ========================================================

    audio_data = await file.read()

    if len(audio_data) > MAX_FILE_SIZE:

        return {

            "status":
                "Analysis Failed",

            "prediction":
                None,

            "confidence":
                0,

            "risk_level":
                "UNKNOWN",

            "risk_score":
                0,

            "risk_description":
                "The uploaded file is larger than 50 MB.",

            "filename":
                file.filename,

            "message":
                "Please upload an audio file smaller than 50 MB.",

            "recommendations": [

                "Use a shorter recording.",

                "Compress the audio file."

            ]

        }

    if len(audio_data) == 0:

        return {

            "status":
                "Analysis Failed",

            "prediction":
                None,

            "confidence":
                0,

            "risk_level":
                "UNKNOWN",

            "risk_score":
                0,

            "risk_description":
                "The uploaded audio file is empty.",

            "filename":
                file.filename,

            "message":
                "Please upload a valid voice recording.",

            "recommendations": [

                "Record the voice again.",

                "Make sure the audio contains speech."

            ]

        }

    # ========================================================
    # TEMPORARY FILE NAMES
    # ========================================================

    unique_id = str(
        uuid.uuid4()
    )

    file_extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if not file_extension:

        file_extension = ".webm"

    input_filename = (
        f"temp_{unique_id}{file_extension}"
    )

    wav_filename = (
        f"converted_{unique_id}.wav"
    )

    # ========================================================
    # ANALYSIS
    # ========================================================

    try:

        # ----------------------------------------------------
        # SAVE TEMPORARY UPLOAD
        # ----------------------------------------------------

        with open(
            input_filename,
            "wb"
        ) as f:

            f.write(
                audio_data
            )

        print("")
        print("======================================")
        print("🎤 VOXSHIELD AUDIO RECEIVED")
        print("======================================")

        print(
            "Filename:",
            file.filename
        )

        print(
            "Size:",
            len(audio_data),
            "bytes"
        )

        # ----------------------------------------------------
        # FFMPEG CONVERSION
        # ----------------------------------------------------

        print(
            "🔄 Converting audio to 16 kHz mono..."
        )

        command = [

            FFMPEG_PATH,

            "-y",

            "-i",

            input_filename,

            "-ar",

            "16000",

            "-ac",

            "1",

            wav_filename

        ]

        subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )

        print(
            "✅ Audio converted successfully."
        )

        # ----------------------------------------------------
        # EXISTING ML FEATURES
        # ----------------------------------------------------

        features = extract_features(
            wav_filename
        )

        print(
            "✅ 90-feature ML vector created."
        )

        print(
            "Feature shape:",
            features.shape
        )

        # ----------------------------------------------------
        # ML PREDICTION
        # ----------------------------------------------------

        prediction = model.predict(
            features
        )[0]

        probabilities = model.predict_proba(
            features
        )[0]

        confidence = float(
            max(probabilities) * 100
        )

        confidence = round(
            confidence,
            2
        )

        # ----------------------------------------------------
        # ADDITIONAL SECURITY ANALYSIS
        # ----------------------------------------------------

        audio_analysis = analyze_audio_behavior(
            wav_filename
        )

        # ----------------------------------------------------
        # NEW SPEAKER CONSISTENCY ANALYSIS
        # ----------------------------------------------------

        speaker_analysis = (
            analyze_speaker_consistency(
                wav_filename
            )
        )

        # ----------------------------------------------------
        # DETERMINE STATUS
        # ----------------------------------------------------

        if prediction == 1:

            status = "AI / Spoof Voice"

            message = (
                "Warning: The recording shows "
                "characteristics that may indicate "
                "an AI-generated or spoofed voice."
            )

            recommendations = [

                "Do not share OTPs, passwords, or banking information.",

                "Do not transfer money based only on this voice.",

                "Verify the caller using another trusted communication method.",

                "Contact the person directly using a known phone number.",

                "For high-risk transactions, use secondary verification."

            ]

        else:

            status = "Human Voice"

            message = (
                "No strong AI-generated characteristics "
                "were detected in this recording."
            )

            recommendations = [

                "The recording appears consistent with human speech.",

                "For sensitive transactions, continue using "
                "additional verification methods.",

                "Voice detection should not be the only "
                "security control for high-value transactions."

            ]

        # ----------------------------------------------------
        # DYNAMIC SECURITY RISK
        # ----------------------------------------------------

        (
            risk_score,
            risk_level,
            risk_reasons
        ) = calculate_security_risk(

            prediction,

            confidence,

            audio_analysis,

            speaker_analysis

        )

        # ----------------------------------------------------
        # RISK DESCRIPTION
        # ----------------------------------------------------

        if risk_level == "HIGH":

            risk_description = (
                "High impersonation risk. The detection "
                "signals indicate that this voice should "
                "be treated as potentially synthetic or spoofed."
            )

        elif risk_level == "MEDIUM":

            risk_description = (
                "Moderate impersonation risk. Additional "
                "verification is recommended before taking "
                "any sensitive action."
            )

        elif risk_level == "LOW":

            risk_description = (
                "Low detected impersonation risk based on "
                "the available voice analysis signals."
            )

        else:

            risk_description = (
                "The result is uncertain. The available "
                "signals are not strong enough for a "
                "high-confidence security decision."
            )

        # ----------------------------------------------------
        # SECURITY ACTION
        # ----------------------------------------------------

        if risk_level == "HIGH":

            security_action = (
                "SECONDARY_VERIFICATION"
            )

        elif risk_level == "MEDIUM":

            security_action = (
                "VERIFY"
            )

        elif risk_level == "LOW":

            security_action = (
                "ALLOW_WITH_MONITORING"
            )

        else:

            security_action = (
                "MANUAL_REVIEW"
            )

        # ----------------------------------------------------
        # PRINT RESULT
        # ----------------------------------------------------

        print("")

        print("======================================")
        print("🧠 VOXSHIELD ANALYSIS RESULT")
        print("======================================")

        print(
            "Prediction:",
            status
        )

        print(
            "Confidence:",
            confidence,
            "%"
        )

        print(
            "Risk Score:",
            risk_score
        )

        print(
            "Risk Level:",
            risk_level
        )

        print(
            "Security Action:",
            security_action
        )

        print(
            "Speaker Status:",
            speaker_analysis.get(
                "speaker_status"
            )
        )

        print(
            "Speaker Match:",
            speaker_analysis.get(
                "speaker_match_score"
            )
        )

        print("======================================")
        print("")

        # ----------------------------------------------------
        # RETURN TO REACT
        # ----------------------------------------------------

        return {

            "status":
                status,

            "prediction":
                int(prediction),

            "confidence":
                confidence,

            "risk_level":
                risk_level,

            "risk_score":
                risk_score,

            "risk_description":
                risk_description,

            "security_action":
                security_action,

            "filename":
                file.filename,

            "message":
                message,

            "recommendations":
                recommendations,

            "risk_reasons":
                risk_reasons,

            "audio_analysis":
                audio_analysis,

            # =================================================
            # NEW SPEAKER INFORMATION
            # =================================================

            "speaker_analysis":
                speaker_analysis,

            "speaker_match_score":
                speaker_analysis.get(
                    "speaker_match_score"
                ),

            "speaker_status":
                speaker_analysis.get(
                    "speaker_status"
                ),

            "speaker_consistency":
                speaker_analysis.get(
                    "speaker_consistency"
                ),

            # =================================================
            # MODULE STATUS
            # =================================================

            "analysis_modules": {

                "ml_acoustic_spectral":
                    True,

                "silence_analysis":
                    True,

                "speech_activity_analysis":
                    True,

                "pitch_analysis":
                    True,

                "energy_analysis":
                    True,

                "speaker_fingerprint":
                    True,

                "cross_session_speaker_analysis":
                    True,

                "contextual_transaction_analysis":
                    "Planned",

                "live_call_stream_analysis":
                    "Planned"

            }

        }

    # ========================================================
    # FFMPEG ERROR
    # ========================================================

    except subprocess.CalledProcessError:

        print(
            "❌ FFmpeg failed to convert the audio."
        )

        return {

            "status":
                "Analysis Failed",

            "prediction":
                None,

            "confidence":
                0,

            "risk_level":
                "UNKNOWN",

            "risk_score":
                0,

            "risk_description":
                "The uploaded audio could not be converted.",

            "filename":
                file.filename,

            "message":
                "Audio conversion failed.",

            "recommendations": [

                "Try recording the voice again.",

                "Use MP3, WAV, M4A, or another supported format.",

                "Check that FFmpeg is installed correctly."

            ]

        }

    # ========================================================
    # OTHER ERRORS
    # ========================================================

    except Exception as e:

        print(
            "❌ Analysis error:",
            str(e)
        )

        return {

            "status":
                "Analysis Failed",

            "prediction":
                None,

            "confidence":
                0,

            "risk_level":
                "UNKNOWN",

            "risk_score":
                0,

            "risk_description":
                "An unexpected error occurred during analysis.",

            "filename":
                file.filename,

            "message":
                str(e),

            "recommendations": [

                "Try analyzing the recording again.",

                "Check the backend terminal for the error."

            ]

        }

    # ========================================================
    # DELETE TEMPORARY FILES
    # ========================================================

    finally:

        if os.path.exists(
            input_filename
        ):

            os.remove(
                input_filename
            )

            print(
                "🗑️ Temporary uploaded file deleted."
            )

        if os.path.exists(
            wav_filename
        ):

            os.remove(
                wav_filename
            )

            print(
                "🗑️ Temporary WAV file deleted."
            )


# ============================================================
# SECONDARY VERIFICATION ENDPOINT
# SIH26104 PREVENTION WORKFLOW
# ============================================================

@app.post("/verify")
async def secondary_verification(
    data: dict
):

    risk_level = str(
        data.get(
            "risk_level",
            "UNKNOWN"
        )
    ).upper()

    confidence = float(
        data.get(
            "confidence",
            0
        )
    )

    # --------------------------------------------------------
    # HIGH RISK
    # --------------------------------------------------------

    if risk_level == "HIGH":

        return {

            "verification_required":
                True,

            "verification_type":
                "SECONDARY_VERIFICATION",

            "security_action":
                "BLOCK_PENDING_VERIFICATION",

            "message":
                (
                    "High-risk voice detected. "
                    "Secondary verification is required "
                    "before continuing."
                ),

            "verification_options": [

                "OTP verification",

                "Trusted-number callback",

                "Supervisor approval",

                "Identity confirmation"

            ]

        }

    # --------------------------------------------------------
    # MEDIUM RISK
    # --------------------------------------------------------

    elif risk_level == "MEDIUM":

        return {

            "verification_required":
                True,

            "verification_type":
                "CALLER_VERIFICATION",

            "security_action":
                "VERIFY_BEFORE_ACTION",

            "message":
                (
                    "Moderate voice impersonation risk detected. "
                    "Verify the caller before performing "
                    "sensitive actions."
                ),

            "verification_options": [

                "OTP verification",

                "Trusted-number callback",

                "Identity confirmation"

            ]

        }

    # --------------------------------------------------------
    # LOW RISK
    # --------------------------------------------------------

    elif risk_level == "LOW":

        return {

            "verification_required":
                False,

            "verification_type":
                "NONE",

            "security_action":
                "ALLOW_WITH_MONITORING",

            "message":
                (
                    "No strong impersonation risk was detected. "
                    "Normal security monitoring can continue."
                ),

            "verification_options":
                []

        }

    # --------------------------------------------------------
    # UNCERTAIN
    # --------------------------------------------------------

    else:

        return {

            "verification_required":
                True,

            "verification_type":
                "MANUAL_REVIEW",

            "security_action":
                "HOLD_FOR_REVIEW",

            "message":
                (
                    "The voice analysis is uncertain. "
                    "Manual verification is recommended "
                    "before performing sensitive actions."
                ),

            "verification_options": [

                "Trusted-number callback",

                "OTP verification",

                "Manual identity verification"

            ]

        }