# AI Voice Guard

## AI-Powered Voice Cloning Fraud Detection System

AI Voice Guard is an AI-powered web application designed to detect whether an uploaded or recorded voice sample is likely to be a **Human Voice** or an **AI-Generated / Spoofed Voice**.

The system uses a React frontend, Python FastAPI backend, machine learning-based audio analysis, and Firebase Firestore to store detection history.

---

## Problem Statement

Recent advances in Generative AI and voice cloning technology make it possible to create highly realistic synthetic voices from only a few seconds of recorded speech.

Attackers can use cloned voices to impersonate:

- Company executives
- Government officials
- Employees
- Family members
- Trusted individuals

This can be used for fraud, financial scams, social engineering, and bypassing voice-based verification.

AI Voice Guard aims to provide an additional layer of protection by analyzing audio and identifying characteristics associated with AI-generated or spoofed voices.

---

## Key Features

### 1. Voice Upload

Users can upload an audio file for analysis.

Supported formats include:

- MP3
- WAV
- M4A
- FLAC

### 2. Voice Recording

Users can record their voice directly through the browser using the microphone.

### 3. AI Voice Detection

The backend analyzes the uploaded audio using a machine learning model and predicts:

- Human Voice
- AI / Spoof Voice

### 4. Confidence Score

The system provides a confidence percentage for the prediction.

Example:

```text
Prediction: Human Voice
Confidence: 87.67%