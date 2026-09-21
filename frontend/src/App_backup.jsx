import { useState, useRef, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import "./App.css";

/* =========================================================
   LIVE SIGNAL VISUALIZER
   Uses the microphone's actual audio signal while recording.
   ========================================================= */

function SignalVisualizer({ stream, active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!stream || !active) return;

    let animationId;
    let audioContext;
    let analyser;

    const startVisualizer = async () => {
      try {
        audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        const draw = () => {
          animationId = requestAnimationFrame(draw);

          analyser.getByteTimeDomainData(dataArray);

          const width = canvas.width;
          const height = canvas.height;

          ctx.clearRect(0, 0, width, height);

          ctx.beginPath();

          for (let i = 0; i < bufferLength; i++) {
            const x = (i / (bufferLength - 1)) * width;
            const y =
              (dataArray[i] / 255) * height;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.lineWidth = 3;
          ctx.strokeStyle = "#25e0d2";
          ctx.shadowBlur = 15;
          ctx.shadowColor = "#25e0d2";
          ctx.stroke();
          ctx.shadowBlur = 0;
        };

        draw();
      } catch (error) {
        console.error("Visualizer error:", error);
      }
    };

    startVisualizer();

    return () => {
      cancelAnimationFrame(animationId);

      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, [stream, active]);

  return (
    <canvas
      ref={canvasRef}
      className="signal-canvas"
      width="900"
      height="220"
    />
  );
}

/* =========================================================
   STATIC SIGNAL GRAPH
   Decorative analysis visualization used after upload.
   It does not replace the ML result.
   ========================================================= */

function StaticSignalGraph({ analyzing = false }) {
  const bars = [
    34, 55, 42, 72, 48, 81, 62, 39, 74, 92,
    58, 47, 86, 66, 44, 78, 52, 89, 63, 45,
    70, 95, 57, 68, 43, 77, 61, 83, 49, 73,
    91, 54, 69, 46, 80, 59, 87, 51, 76, 64
  ];

  return (
    <div className={`static-signal ${analyzing ? "signal-active" : ""}`}>
      <div className="signal-grid-lines"></div>

      <div className="signal-bars">
        {bars.map((height, index) => (
          <span
            key={index}
            style={{
              height: `${height}%`,
              animationDelay: `${index * 0.035}s`,
            }}
          />
        ))}
      </div>

      <div className="signal-axis">
        <span>0s</span>
        <span>2s</span>
        <span>4s</span>
        <span>6s</span>
        <span>8s</span>
        <span>10s</span>
      </div>

      {analyzing && (
        <div className="scan-line"></div>
      )}
    </div>
  );
}

/* =========================================================
   3D SHIELD
   ========================================================= */

function SecurityShield() {
  return (
    <div className="shield-scene">
      <div className="shield-orbit orbit-one"></div>
      <div className="shield-orbit orbit-two"></div>

      <div className="shield-glow"></div>

      <div className="shield-3d">
        <div className="shield-inner">
          <div className="shield-microphone">
            <div className="mic-head"></div>
            <div className="mic-body"></div>
            <div className="mic-stand"></div>
            <div className="mic-base"></div>
          </div>

          <div className="shield-check">✓</div>
        </div>
      </div>

      <div className="floating-node node-one">AI</div>
      <div className="floating-node node-two">VOICE</div>
      <div className="floating-node node-three">SECURE</div>
    </div>
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */

function App() {
  const [activePage, setActivePage] = useState("home");

  const [audioFile, setAudioFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const [recordingStream, setRecordingStream] = useState(null);

  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL");

  const [verificationStarted, setVerificationStarted] =
    useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  /* =========================================================
     LOAD FIREBASE HISTORY
     ========================================================= */

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const q = query(
          collection(db, "detectionHistory"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        const historyData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setHistory(historyData);
      } catch (error) {
        console.error(
          "Error loading history:",
          error
        );
      }
    };

    loadHistory();
  }, []);

  /* =========================================================
     START RECORDING
     ========================================================= */

  const startRecording = async () => {
    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        alert(
          "Microphone recording is not supported by this browser."
        );
        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const mediaRecorder =
        new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      setRecordingStream(stream);
      setAudioFile(null);
      setResult(null);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(
            event.data
          );
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(
          audioChunksRef.current,
          {
            type: "audio/webm",
          }
        );

        const recordedFile = new File(
          [audioBlob],
          "Recorded Voice.webm",
          {
            type: "audio/webm",
          }
        );

        setAudioFile(recordedFile);

        stream
          .getTracks()
          .forEach((track) => track.stop());

        setRecordingStream(null);
      };

      mediaRecorder.start();

      setIsRecording(true);
    } catch (error) {
      console.error(
        "Microphone error:",
        error
      );

      alert(
        "Microphone permission was denied or your microphone is unavailable."
      );
    }
  };

  /* =========================================================
     STOP RECORDING
     ========================================================= */

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /* =========================================================
     FILE UPLOAD
     ========================================================= */

  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setAudioFile(file);
    setResult(null);
    setActivePage("detection");
  };

  /* =========================================================
     RISK CLASS
     ========================================================= */

  const getRiskClass = (riskLevel) => {
    if (!riskLevel) return "risk-unknown";

    switch (riskLevel.toUpperCase()) {
      case "HIGH":
        return "risk-high";

      case "MEDIUM":
        return "risk-medium";

      case "LOW":
        return "risk-low";

      case "UNCERTAIN":
        return "risk-uncertain";

      default:
        return "risk-unknown";
    }
  };

  /* =========================================================
     RISK ICON
     ========================================================= */

  const getRiskIcon = (riskLevel) => {
    if (!riskLevel) return "◆";

    switch (riskLevel.toUpperCase()) {
      case "HIGH":
        return "●";

      case "MEDIUM":
        return "●";

      case "LOW":
        return "●";

      case "UNCERTAIN":
        return "●";

      default:
        return "◆";
    }
  };

  /* =========================================================
     CHECK IF AI RESULT
     ========================================================= */

  const isPotentialAI = (status) => {
    const value = status?.toLowerCase() || "";

    return (
      value.includes("ai") ||
      value.includes("spoof") ||
      value.includes("possible")
    );
  };

  /* =========================================================
     ANALYZE VOICE
     ========================================================= */

  const analyzeVoice = async () => {
    if (!audioFile) {
      alert(
        "Please record or upload an audio file first."
      );
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setVerificationStarted(false);

    try {
      const formData = new FormData();

      formData.append("file", audioFile);

      const response = await fetch(
        "http://127.0.0.1:8000/detect",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          "Backend analysis failed."
        );
      }

      const data = await response.json();

      setResult(data);

      /* SAVE RESULT TO FIREBASE */

      const historyData = {
        date: new Date().toLocaleString(),
        filename: data.filename,
        status: data.status,
        confidence: data.confidence,
        risk_level:
          data.risk_level || "Unknown",
        risk_description:
          data.risk_description || "",
        createdAt: new Date(),
      };

      const docRef = await addDoc(
        collection(db, "detectionHistory"),
        historyData
      );

      setHistory((prev) => [
        {
          id: docRef.id,
          ...historyData,
        },
        ...prev,
      ]);
    } catch (error) {
      console.error(
        "Analysis error:",
        error
      );

      alert(
        "Unable to connect to the AI backend. Make sure your FastAPI server is running."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  /* =========================================================
     RESET DETECTION
     ========================================================= */

  const resetDetection = () => {
    setAudioFile(null);
    setResult(null);
    setIsAnalyzing(false);
    setVerificationStarted(false);

    setActivePage("detection");
  };

  /* =========================================================
     NAVIGATION
     ========================================================= */

  const goToPage = (page) => {
    setActivePage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================================================
     DASHBOARD STATISTICS
     ========================================================= */

  const totalAnalyses = history.length;

  const humanCount = history.filter(
    (item) =>
      item.status
        ?.toLowerCase()
        .includes("human")
  ).length;

  const aiCount = history.filter(
    (item) => isPotentialAI(item.status)
  ).length;

  const aiRate =
    totalAnalyses > 0
      ? Math.round(
          (aiCount / totalAnalyses) * 100
        )
      : 0;

  const highRiskCount = history.filter(
    (item) =>
      item.risk_level?.toUpperCase() ===
      "HIGH"
  ).length;

  const mediumRiskCount = history.filter(
    (item) =>
      item.risk_level?.toUpperCase() ===
      "MEDIUM"
  ).length;

  const uncertainRiskCount = history.filter(
    (item) =>
      item.risk_level?.toUpperCase() ===
      "UNCERTAIN"
  ).length;

  const lowRiskCount = history.filter(
    (item) =>
      item.risk_level?.toUpperCase() ===
      "LOW"
  ).length;

  /* =========================================================
     HISTORY FILTER
     ========================================================= */

  const filteredHistory = history.filter(
    (item) => {
      const search =
        historySearch.toLowerCase();

      const matchesSearch =
        item.filename
          ?.toLowerCase()
          .includes(search) ||
        item.status
          ?.toLowerCase()
          .includes(search) ||
        item.risk_level
          ?.toLowerCase()
          .includes(search);

      let matchesFilter = true;

      if (historyFilter === "AI") {
        matchesFilter = isPotentialAI(
          item.status
        );
      }

      if (historyFilter === "HUMAN") {
        matchesFilter =
          item.status
            ?.toLowerCase()
            .includes("human");
      }

      if (historyFilter === "HIGH") {
        matchesFilter =
          item.risk_level?.toUpperCase() ===
          "HIGH";
      }

      return (
        matchesSearch && matchesFilter
      );
    }
  );

  /* =========================================================
     DASHBOARD TREND DATA
     ========================================================= */

  const trendData = history
    .slice(0, 7)
    .reverse();

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="app">

      {/* =====================================================
          NAVBAR
          ===================================================== */}

      <nav className="navbar">

        <div
          className="logo"
          onClick={() => goToPage("home")}
        >
          <div className="logo-shield">
            V
          </div>

          <div className="logo-text">
            <strong>
              VOXSHIELD
            </strong>

            <span>AI</span>
          </div>
        </div>

        <div className="nav-links">

          <button
            className={
              activePage === "home"
                ? "active"
                : ""
            }
            onClick={() =>
              goToPage("home")
            }
          >
            <span>⌂</span>
            Home
          </button>

          <button
            className={
              activePage === "dashboard"
                ? "active"
                : ""
            }
            onClick={() =>
              goToPage("dashboard")
            }
          >
            <span>◈</span>
            Dashboard
          </button>

          <button
            className={
              activePage === "detection"
                ? "active"
                : ""
            }
            onClick={() =>
              goToPage("detection")
            }
          >
            <span>◉</span>
            Detection
          </button>

          <button
            className={
              activePage === "history"
                ? "active"
                : ""
            }
            onClick={() =>
              goToPage("history")
            }
          >
            <span>▤</span>
            History
          </button>

        </div>

        <div className="system-status">
          <span className="status-dot"></span>
          SYSTEM ONLINE
        </div>

      </nav>

      {/* =====================================================
          HOME
          ===================================================== */}

      {activePage === "home" && (
        <main>

          <section className="hero">

            <div className="hero-background-grid"></div>

            <div className="hero-content">

              <div className="hero-copy">

                <div className="hero-badge">
                  <span className="pulse-dot"></span>
                  AI-POWERED VOICE SECURITY
                </div>

                <h1>
                  Protect trust
                  <br />
                  <span>
                    behind every voice.
                  </span>
                </h1>

                <p>
                  VoxShield AI analyzes voice
                  recordings for potential synthetic
                  speech and provides a security risk
                  signal before sensitive actions are
                  taken.
                </p>

                <div className="hero-buttons">

                  <button
                    className="primary-button"
                    onClick={() =>
                      goToPage("detection")
                    }
                  >
                    <span>◉</span>
                    Start Detection
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      goToPage("dashboard")
                    }
                  >
                    View Security Dashboard
                    <span>→</span>
                  </button>

                </div>

                <div className="hero-stats">

                  <div>
                    <strong>
                      {totalAnalyses}
                    </strong>
                    <span>
                      Analyses
                    </span>
                  </div>

                  <div>
                    <strong>
                      {aiCount}
                    </strong>
                    <span>
                      AI/Spoof
                    </span>
                  </div>

                  <div>
                    <strong>
                      {highRiskCount}
                    </strong>
                    <span>
                      High Risk
                    </span>
                  </div>

                </div>

              </div>

              <div className="hero-visual">

                <SecurityShield />

                <div className="hero-terminal">

                  <div className="terminal-top">
                    <span>
                      VOXSHIELD ENGINE
                    </span>

                    <span className="terminal-live">
                      LIVE
                    </span>
                  </div>

                  <div className="terminal-lines">
                    <p>
                      <span>01</span>
                      Signal acquisition
                      <b>OK</b>
                    </p>

                    <p>
                      <span>02</span>
                      Acoustic analysis
                      <b>READY</b>
                    </p>

                    <p>
                      <span>03</span>
                      AI detection engine
                      <b>ONLINE</b>
                    </p>

                    <p>
                      <span>04</span>
                      Risk assessment
                      <b>ACTIVE</b>
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* =================================================
              CAPABILITIES
              ================================================= */}

          <section className="features-section">

            <div className="section-heading">

              <span className="section-label">
                CORE CAPABILITIES
              </span>

              <h2>
                One voice.
                <span>
                  Multiple security signals.
                </span>
              </h2>

              <p>
                VoxShield AI combines voice
                acquisition, acoustic analysis,
                machine-learning detection and
                security-oriented risk assessment.
              </p>

            </div>

            <div className="features-grid">

              <div className="feature-card feature-card-3d">

                <div className="feature-number">
                  01
                </div>

                <div className="feature-icon">
                  ◉
                </div>

                <h3>
                  Voice Analysis
                </h3>

                <p>
                  Capture a voice through the
                  microphone or upload an existing
                  recording for analysis.
                </p>

                <div className="feature-line"></div>

              </div>

              <div className="feature-card feature-card-3d">

                <div className="feature-number">
                  02
                </div>

                <div className="feature-icon">
                  ◈
                </div>

                <h3>
                  AI Detection
                </h3>

                <p>
                  Your current machine-learning
                  pipeline evaluates acoustic and
                  spectral characteristics.
                </p>

                <div className="feature-line"></div>

              </div>

              <div className="feature-card feature-card-3d">

                <div className="feature-number">
                  03
                </div>

                <div className="feature-icon">
                  ◆
                </div>

                <h3>
                  Risk Intelligence
                </h3>

                <p>
                  Convert the model prediction and
                  confidence into a clear security
                  risk level.
                </p>

                <div className="feature-line"></div>

              </div>

              <div className="feature-card feature-card-3d">

                <div className="feature-number">
                  04
                </div>

                <div className="feature-icon">
                  ▣
                </div>

                <h3>
                  Secure History
                </h3>

                <p>
                  Keep detection metadata available
                  through your Firebase-powered
                  analysis history.
                </p>

                <div className="feature-line"></div>

              </div>

            </div>

          </section>

          {/* =================================================
              SIGNAL LAB PREVIEW
              ================================================= */}

          <section className="signal-preview-section">

            <div className="signal-preview-copy">

              <span className="section-label">
                VOICE SIGNAL LAB
              </span>

              <h2>
                See the voice
                <br />
                <span>while VoxShield analyzes it.</span>
              </h2>

              <p>
                During microphone recording, the
                interface visualizes the incoming
                audio signal. The visualization is
                connected to the browser microphone
                stream and is separate from the ML
                classification result.
              </p>

              <div className="signal-tags">
                <span>WAVEFORM</span>
                <span>FREQUENCY</span>
                <span>AMPLITUDE</span>
              </div>

            </div>

            <div className="signal-preview-card">

              <div className="signal-card-header">

                <div>
                  <span className="mini-label">
                    SIGNAL MONITOR
                  </span>

                  <strong>
                    VOICE INPUT
                  </strong>
                </div>

                <span className="monitor-dot">
                  ● READY
                </span>

              </div>

              <StaticSignalGraph />

              <div className="signal-card-footer">

                <span>
                  16 kHz analysis pipeline
                </span>

                <span>
                  ● EDGE VISUALIZATION
                </span>

              </div>

            </div>

          </section>

          {/* =================================================
              HOW IT WORKS
              ================================================= */}

          <section className="how-it-works-section">

            <div className="section-heading">

              <span className="section-label">
                SECURITY PIPELINE
              </span>

              <h2>
                From voice
                <span>
                  to security decision.
                </span>
              </h2>

            </div>

            <div className="workflow-grid">

              {[
                [
                  "01",
                  "Capture",
                  "Record a voice or upload an existing audio file."
                ],
                [
                  "02",
                  "Process",
                  "Prepare the audio for the machine-learning pipeline."
                ],
                [
                  "03",
                  "Extract",
                  "Analyze acoustic and spectral characteristics."
                ],
                [
                  "04",
                  "Detect",
                  "Evaluate the extracted features using the ML model."
                ],
                [
                  "05",
                  "Protect",
                  "Generate confidence, risk information and security guidance."
                ],
              ].map(
                ([number, title, text]) => (
                  <div
                    className="workflow-card"
                    key={number}
                  >
                    <div className="workflow-number">
                      {number}
                    </div>

                    <div className="workflow-connector"></div>

                    <h3>{title}</h3>

                    <p>{text}</p>
                  </div>
                )
              )}

            </div>

          </section>

          {/* =================================================
              SIH ALIGNMENT
              ================================================= */}

          <section className="sih-section">

            <div className="sih-glow"></div>

            <div className="sih-content">

              <span className="section-label">
                SECURITY-FIRST ARCHITECTURE
              </span>

              <h2>
                Detection is only
                <span>
                  the first layer.
                </span>
              </h2>

              <p>
                VoxShield AI is designed around the
                idea that a suspicious voice should
                trigger additional verification rather
                than automatic trust.
              </p>

              <div className="sih-points">

                <div>
                  <span>✓</span>
                  Dynamic risk assessment
                </div>

                <div>
                  <span>✓</span>
                  Secondary verification workflow
                </div>

                <div>
                  <span>✓</span>
                  Security-focused audit history
                </div>

                <div>
                  <span>✓</span>
                  Privacy-aware metadata logging
                </div>

              </div>

            </div>

          </section>

        </main>
      )}

      {/* =====================================================
          DASHBOARD
          ===================================================== */}

      {activePage === "dashboard" && (
        <section className="page-section">

          <div className="page-header">

            <span className="section-label">
              SECURITY COMMAND CENTER
            </span>

            <h1>
              VoxShield Dashboard
            </h1>

            <p>
              Monitor voice detection activity,
              model outcomes and security risk.
            </p>

          </div>

          <div className="dashboard-grid">

            <div className="dashboard-card">
              <span className="card-symbol">
                ◈
              </span>

              <h3>
                Total Analyses
              </h3>

              <strong>
                {totalAnalyses}
              </strong>

              <small>
                Firebase records
              </small>
            </div>

            <div className="dashboard-card">
              <span className="card-symbol">
                ●
              </span>

              <h3>
                Human Voices
              </h3>

              <strong>
                {humanCount}
              </strong>

              <small>
                Classified human
              </small>
            </div>

            <div className="dashboard-card danger-card">
              <span className="card-symbol">
                ⚠
              </span>

              <h3>
                AI / Spoof
              </h3>

              <strong>
                {aiCount}
              </strong>

              <small>
                Potential synthetic
              </small>
            </div>

            <div className="dashboard-card">
              <span className="card-symbol">
                %
              </span>

              <h3>
                AI / Spoof Rate
              </h3>

              <strong>
                {aiRate}%
              </strong>

              <small>
                Based on recorded history
              </small>
            </div>

          </div>

          {/* DASHBOARD MAIN GRID */}

          <div className="dashboard-main-grid">

            {/* TREND */}

            <div className="dashboard-card-large">

              <div className="large-card-header">

                <div>
                  <span className="mini-label">
                    ACTIVITY
                  </span>

                  <h2>
                    Detection Activity
                  </h2>
                </div>

                <span className="live-chip">
                  FIREBASE DATA
                </span>

              </div>

              {trendData.length === 0 ? (

                <div className="empty-chart">
                  <div className="chart-placeholder-icon">
                    ∿
                  </div>

                  <p>
                    Detection activity will appear
                    here after your first analysis.
                  </p>
                </div>

              ) : (

                <div className="activity-chart">

                  <div className="chart-y-labels">
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>0</span>
                  </div>

                  <div className="chart-area">

                    <div className="chart-grid">
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                    </div>

                    <div className="chart-bars">

                      {trendData.map(
                        (item, index) => {

                          const confidence =
                            Number(
                              item.confidence
                            ) || 0;

                          return (
                            <div
                              className="chart-column"
                              key={
                                item.id ||
                                index
                              }
                            >
                              <div
                                className={
                                  `chart-bar ${
                                    isPotentialAI(
                                      item.status
                                    )
                                      ? "chart-ai"
                                      : "chart-human"
                                  }`
                                }
                                style={{
                                  height: `${Math.max(
                                    confidence,
                                    8
                                  )}%`,
                                }}
                              >
                                <span>
                                  {confidence}%
                                </span>
                              </div>

                              <small>
                                #{index + 1}
                              </small>
                            </div>
                          );
                        }
                      )}

                    </div>

                  </div>

                </div>

              )}

              <div className="chart-note">
                Bar height represents the stored
                model confidence for recent analyses.
              </div>

            </div>

            {/* RISK */}

            <div className="dashboard-card-large">

              <div className="large-card-header">

                <div>
                  <span className="mini-label">
                    RISK ENGINE
                  </span>

                  <h2>
                    Risk Distribution
                  </h2>
                </div>

              </div>

              <div className="risk-orb-container">

                <div className="risk-orb">

                  <div className="risk-orb-inner">
                    <strong>
                      {highRiskCount}
                    </strong>

                    <span>
                      HIGH
                    </span>
                  </div>

                </div>

              </div>

              <div className="risk-list">

                <div>
                  <span className="risk-dot high"></span>
                  High Risk
                  <strong>
                    {highRiskCount}
                  </strong>
                </div>

                <div>
                  <span className="risk-dot medium"></span>
                  Medium Risk
                  <strong>
                    {mediumRiskCount}
                  </strong>
                </div>

                <div>
                  <span className="risk-dot uncertain"></span>
                  Uncertain
                  <strong>
                    {uncertainRiskCount}
                  </strong>
                </div>

                <div>
                  <span className="risk-dot low"></span>
                  Low Risk
                  <strong>
                    {lowRiskCount}
                  </strong>
                </div>

              </div>

            </div>

          </div>

          {/* SECURITY STATUS */}

          <div className="dashboard-card-large">

            <div className="large-card-header">

              <div>
                <span className="mini-label">
                  SYSTEM STATUS
                </span>

                <h2>
                  Security Status
                </h2>
              </div>

              <span className="live-chip">
                MONITORING
              </span>

            </div>

            {aiCount > 0 ? (

              <div className="security-status-panel warning">

                <div className="security-status-icon">
                  !
                </div>

                <div>
                  <strong>
                    Potential synthetic voices detected
                  </strong>

                  <p>
                    {aiCount} stored analysis
                    {aiCount !== 1
                      ? "es"
                      : ""} returned a possible
                    AI-generated or spoofed voice
                    result.
                  </p>
                </div>

              </div>

            ) : (

              <div className="security-status-panel safe">

                <div className="security-status-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    No potential threats recorded
                  </strong>

                  <p>
                    No AI or spoof voice detections
                    are currently stored in the
                    analysis history.
                  </p>
                </div>

              </div>

            )}

          </div>

          {/* RECENT */}

          <div className="dashboard-card-large">

            <div className="large-card-header">

              <div>
                <span className="mini-label">
                  LATEST EVENTS
                </span>

                <h2>
                  Recent Analysis
                </h2>
              </div>

              <button
                className="text-button"
                onClick={() =>
                  goToPage("history")
                }
              >
                View full history →
              </button>

            </div>

            {history.length === 0 ? (

              <div className="empty-state-small">
                No analyses available yet.
              </div>

            ) : (

              <div className="recent-list">

                {history
                  .slice(0, 5)
                  .map((item) => (

                    <div
                      className="recent-item"
                      key={item.id}
                    >

                      <div className="recent-icon">
                        {isPotentialAI(
                          item.status
                        )
                          ? "!"
                          : "✓"}
                      </div>

                      <div className="recent-main">

                        <strong>
                          {item.status}
                        </strong>

                        <span>
                          {item.filename}
                        </span>

                      </div>

                      <div className="recent-meta">

                        <span
                          className={`risk-badge ${getRiskClass(
                            item.risk_level
                          )}`}
                        >
                          {getRiskIcon(
                            item.risk_level
                          )}{" "}
                          {item.risk_level ||
                            "Unknown"}
                        </span>

                        <strong>
                          {item.confidence}%
                        </strong>

                      </div>

                    </div>

                  ))}

              </div>

            )}

          </div>

        </section>
      )}

      {/* =====================================================
          DETECTION
          ===================================================== */}

      {activePage === "detection" && (
        <section className="page-section detection-page">

          <div className="page-header">

            <span className="section-label">
              VOICE INTEGRITY LAB
            </span>

            <h1>
              Analyze a voice
            </h1>

            <p>
              Record or upload audio and send it
              through the VoxShield AI detection
              pipeline.
            </p>

          </div>

          <div className="detection-top-grid">

            {/* RECORD */}

            <div className="record-card futuristic-card">

              <div className="card-top-label">
                LIVE INPUT
              </div>

              <div className="record-icon-large">
                <div className="mini-mic">
                  <div></div>
                </div>
              </div>

              <h2>
                Record Voice
              </h2>

              <p>
                Use your microphone to capture a
                voice sample.
              </p>

              {!isRecording ? (

                <button
                  className="record-button"
                  onClick={startRecording}
                >
                  <span>●</span>
                  Start Recording
                </button>

              ) : (

                <button
                  className="stop-button"
                  onClick={stopRecording}
                >
                  <span>■</span>
                  Stop Recording
                </button>

              )}

              {isRecording && (
                <div className="recording-status">
                  <span className="recording-dot"></span>
                  RECORDING IN PROGRESS
                </div>
              )}

            </div>

            {/* UPLOAD */}

            <div className="upload-card futuristic-card">

              <div className="card-top-label">
                AUDIO INPUT
              </div>

              <div className="upload-orbit">
                <div>
                  ↑
                </div>
              </div>

              <h2>
                Upload Audio
              </h2>

              <p>
                MP3, WAV, M4A and WEBM supported.
              </p>

              <label className="upload-button">
                Choose Audio File

                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.webm,audio/*"
                  onChange={handleFileUpload}
                  hidden
                />
              </label>

            </div>

          </div>

          {/* LIVE SIGNAL */}

          {isRecording && recordingStream && (

            <div className="analysis-lab-card">

              <div className="analysis-lab-header">

                <div>
                  <span className="mini-label">
                    LIVE SIGNAL MONITOR
                  </span>

                  <h2>
                    Voice Signal
                  </h2>
                </div>

                <div className="live-analysis-chip">
                  <span></span>
                  LIVE
                </div>

              </div>

              <div className="live-wave-wrapper">

                <SignalVisualizer
                  stream={
                    recordingStream
                  }
                  active={isRecording}
                />

                <div className="wave-center-line"></div>

              </div>

              <div className="signal-metrics">

                <div>
                  <span>
                    SIGNAL
                  </span>
                  <strong>
                    ACTIVE
                  </strong>
                </div>

                <div>
                  <span>
                    INPUT
                  </span>
                  <strong>
                    MICROPHONE
                  </strong>
                </div>

                <div>
                  <span>
                    VISUAL
                  </span>
                  <strong>
                    WAVEFORM
                  </strong>
                </div>

              </div>

            </div>

          )}

          {/* SELECTED AUDIO */}

          {audioFile && !isRecording && (

            <div className="selected-file">

              <div className="selected-file-header">

                <div>
                  <span className="mini-label">
                    AUDIO READY
                  </span>

                  <h2>
                    Selected Recording
                  </h2>
                </div>

                <div className="file-status">
                  ✓ READY
                </div>

              </div>

              <div className="file-info">

                <div className="file-icon">
                  ♪
                </div>

                <div>
                  <strong>
                    {audioFile.name}
                  </strong>

                  <span>
                    {audioFile.type ||
                      "Audio recording"}
                  </span>
                </div>

              </div>

              <div className="audio-player-wrapper">

                <audio
                  controls
                  src={
                    audioFile instanceof File
                      ? URL.createObjectURL(
                          audioFile
                        )
                      : undefined
                  }
                />

              </div>

              <div className="pre-analysis-visual">

                <div className="pre-analysis-title">
                  <span>
                    SIGNAL PREVIEW
                  </span>

                  <span>
                    READY FOR ML ANALYSIS
                  </span>
                </div>

                <StaticSignalGraph />

              </div>

              <div className="selected-actions">

                <button
                  className="analyze-button"
                  onClick={analyzeVoice}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing
                    ? "◌ ANALYZING..."
                    : "◎ ANALYZE WITH VOXSHIELD"}
                </button>

                <button
                  className="secondary-button"
                  onClick={resetDetection}
                >
                  Choose Different Audio
                </button>

              </div>

            </div>

          )}

          {/* ANALYZING */}

          {isAnalyzing && (

            <div className="analysis-processing">

              <div className="processing-core">
                <div></div>
                <div></div>
                <div></div>
              </div>

              <span className="section-label">
                VOXSHIELD ENGINE
              </span>

              <h2>
                Analyzing voice signal...
              </h2>

              <p>
                Processing acoustic and spectral
                characteristics through the current
                machine-learning pipeline.
              </p>

              <StaticSignalGraph analyzing />

              <div className="processing-steps">

                <span className="done">
                  ✓ Audio received
                </span>

                <span className="done">
                  ✓ Feature extraction
                </span>

                <span className="active">
                  ◌ ML classification
                </span>

                <span>
                  ○ Risk assessment
                </span>

              </div>

            </div>

          )}

          {/* RESULT */}

          {result && !isAnalyzing && (

            <div className="result-card">

              <div className="result-header">

                <div>

                  <span className="mini-label">
                    ANALYSIS COMPLETE
                  </span>

                  <h2>
                    Voice Integrity Result
                  </h2>

                </div>

                <div
                  className={
                    isPotentialAI(
                      result.status
                    )
                      ? "result-status danger"
                      : "result-status safe"
                  }
                >
                  {isPotentialAI(
                    result.status
                  )
                    ? "THREAT SIGNAL"
                    : "CLEAR SIGNAL"}
                </div>

              </div>

              <div className="result-main-grid">

                {/* RESULT */}

                <div className="result-primary">

                  <div
                    className={
                      isPotentialAI(
                        result.status
                      )
                        ? "result-emblem danger-emblem"
                        : "result-emblem safe-emblem"
                    }
                  >
                    {isPotentialAI(
                      result.status
                    )
                      ? "!"
                      : "✓"}
                  </div>

                  <h3>
                    {result.status}
                  </h3>

                  <p>
                    {result.risk_description ||
                      "Analysis completed successfully."}
                  </p>

                </div>

                {/* CONFIDENCE */}

                <div className="confidence-panel">

                  <span>
                    MODEL CONFIDENCE
                  </span>

                  <div className="confidence-number">
                    {result.confidence}%
                  </div>

                  <div className="confidence-track">

                    <div
                      style={{
                        width: `${Math.min(
                          Number(
                            result.confidence
                          ) || 0,
                          100
                        )}%`,
                      }}
                    ></div>

                  </div>

                  <small>
                    Current prototype ML output
                  </small>

                </div>

              </div>

              {/* RISK */}

              <div
                className={`risk-box ${getRiskClass(
                  result.risk_level
                )}`}
              >

                <div className="risk-box-left">

                  <span className="risk-big-icon">
                    {getRiskIcon(
                      result.risk_level
                    )}
                  </span>

                  <div>
                    <span>
                      SECURITY RISK
                    </span>

                    <strong>
                      {result.risk_level ||
                        "Unknown"}
                    </strong>
                  </div>

                </div>

                <p>
                  {result.risk_description ||
                    "No additional risk information available."}
                </p>

              </div>

              {/* WHY FLAGGED */}

              <div className="explanation-panel">

                <div className="panel-heading">
                  <span>
                    WHY THIS RESULT?
                  </span>

                  <small>
                    CURRENT MODEL
                  </small>
                </div>

                <div className="explanation-grid">

                  <div>
                    <span>01</span>
                    <strong>
                      Acoustic features
                    </strong>
                    <p>
                      Analyzed by the current
                      feature extraction pipeline.
                    </p>
                  </div>

                  <div>
                    <span>02</span>
                    <strong>
                      Spectral characteristics
                    </strong>
                    <p>
                      Included in the current
                      prototype feature set.
                    </p>
                  </div>

                  <div>
                    <span>03</span>
                    <strong>
                      ML prediction
                    </strong>
                    <p>
                      Classification generated by
                      the trained model.
                    </p>
                  </div>

                </div>

                <div className="future-signals">

                  <span>
                    PLANNED SIH EXTENSIONS
                  </span>

                  <div>
                    Prosody analysis
                  </div>

                  <div>
                    Cross-session speaker consistency
                  </div>

                  <div>
                    Contextual fraud intelligence
                  </div>

                </div>

              </div>

              {/* SECURITY RECOMMENDATION */}

              {isPotentialAI(
                result.status
              ) ? (

                <div className="recommendations">

                  <div className="recommendation-heading">

                    <span className="warning-symbol">
                      !
                    </span>

                    <div>
                      <span>
                        SECURITY RESPONSE
                      </span>

                      <h3>
                        Treat this voice as suspicious
                      </h3>
                    </div>

                  </div>

                  <ul>

                    <li>
                      Do not share OTPs, passwords or
                      banking information based only
                      on this voice.
                    </li>

                    <li>
                      Do not transfer money based only
                      on this recording.
                    </li>

                    <li>
                      Verify the caller using another
                      trusted communication channel.
                    </li>

                    <li>
                      Contact the person directly using
                      a known phone number.
                    </li>

                  </ul>

                  <button
                    className="verification-button"
                    onClick={() =>
                      setVerificationStarted(
                        true
                      )
                    }
                  >
                    Start Secondary Verification →
                  </button>

                  {verificationStarted && (

                    <div className="verification-panel">

                      <span className="mini-label">
                        PROTOTYPE WORKFLOW
                      </span>

                      <h3>
                        Choose a verification method
                      </h3>

                      <div className="verification-options">

                        <button>
                          <strong>
                            OTP
                          </strong>
                          <span>
                            One-time verification
                          </span>
                        </button>

                        <button>
                          <strong>
                            CALLBACK
                          </strong>
                          <span>
                            Call known number
                          </span>
                        </button>

                        <button>
                          <strong>
                            VOICE CHALLENGE
                          </strong>
                          <span>
                            Liveness challenge
                          </span>
                        </button>

                        <button>
                          <strong>
                            ESCALATE
                          </strong>
                          <span>
                            Supervisor review
                          </span>
                        </button>

                      </div>

                      <p>
                        These actions are currently
                        prototype UI workflows and are
                        not connected to external
                        banking or telecom systems.
                      </p>

                    </div>

                  )}

                </div>

              ) : (

                <div className="safe-message">

                  <span>
                    ✓
                  </span>

                  <div>
                    <strong>
                      No obvious synthetic signal detected
                    </strong>

                    <p>
                      This result is an additional
                      security signal, not definitive
                      proof of voice authenticity.
                    </p>
                  </div>

                </div>

              )}

            </div>

          )}

          {/* PRIVACY */}

          <div className="privacy-panel">

            <div className="privacy-icon">
              ◇
            </div>

            <div>

              <span>
                PRIVACY MODE
              </span>

              <strong>
                Feature-focused logging
              </strong>

              <p>
                The current application sends the
                selected audio temporarily to the local
                FastAPI backend for analysis. Firebase
                stores detection metadata rather than
                the raw audio file.
              </p>

            </div>

            <div className="privacy-status">
              LOCAL API
              <br />
              ACTIVE
            </div>

          </div>

        </section>
      )}

      {/* =====================================================
          HISTORY
          ===================================================== */}

      {activePage === "history" && (
        <section className="page-section">

          <div className="page-header">

            <span className="section-label">
              SECURE ANALYSIS LOG
            </span>

            <h1>
              Detection History
            </h1>

            <p>
              Review previous voice analysis
              metadata stored in Firebase.
            </p>

          </div>

          {history.length === 0 ? (

            <div className="empty-history">

              <div className="empty-history-icon">
                ◫
              </div>

              <h2>
                No Detection History
              </h2>

              <p>
                Your voice analysis results will
                appear here after your first detection.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  goToPage("detection")
                }
              >
                Start First Analysis
              </button>

            </div>

          ) : (

            <>

              <div className="history-toolbar">

                <div className="history-search">

                  <span>
                    ⌕
                  </span>

                  <input
                    type="text"
                    placeholder="Search filename, result or risk..."
                    value={historySearch}
                    onChange={(e) =>
                      setHistorySearch(
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="history-filters">

                  {[
                    ["ALL", "All"],
                    ["AI", "AI / Spoof"],
                    ["HUMAN", "Human"],
                    ["HIGH", "High Risk"],
                  ].map(
                    ([value, label]) => (

                      <button
                        key={value}
                        className={
                          historyFilter === value
                            ? "filter-active"
                            : ""
                        }
                        onClick={() =>
                          setHistoryFilter(
                            value
                          )
                        }
                      >
                        {label}
                      </button>

                    )
                  )}

                </div>

              </div>

              <div className="history-summary">

                <span>
                  Showing{" "}
                  <strong>
                    {filteredHistory.length}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {history.length}
                  </strong>{" "}
                  analyses
                </span>

                <span>
                  VOXSHIELD SECURE LOG
                </span>

              </div>

              {filteredHistory.length === 0 ? (

                <div className="empty-state-small">
                  No records match your current
                  search/filter.
                </div>

              ) : (

                <div className="history-table-container">

                  <table className="history-table">

                    <thead>

                      <tr>

                        <th>
                          Date
                        </th>

                        <th>
                          File
                        </th>

                        <th>
                          Result
                        </th>

                        <th>
                          Confidence
                        </th>

                        <th>
                          Risk
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {filteredHistory.map(
                        (item) => (

                          <tr key={item.id}>

                            <td>
                              {item.date}
                            </td>

                            <td>
                              <div className="history-file">

                                <span>
                                  ♪
                                </span>

                                {item.filename}

                              </div>
                            </td>

                            <td>

                              <span
                                className={
                                  item.status
                                    ?.toLowerCase()
                                    .includes(
                                      "human"
                                    )
                                    ? "human-badge"
                                    : "ai-badge"
                                }
                              >
                                {item.status}
                              </span>

                            </td>

                            <td>

                              <div className="table-confidence">

                                <span>
                                  {item.confidence}%
                                </span>

                                <div>
                                  <i
                                    style={{
                                      width: `${Math.min(
                                        Number(
                                          item.confidence
                                        ) || 0,
                                        100
                                      )}%`,
                                    }}
                                  ></i>
                                </div>

                              </div>

                            </td>

                            <td>

                              <span
                                className={`risk-badge ${getRiskClass(
                                  item.risk_level
                                )}`}
                              >
                                {getRiskIcon(
                                  item.risk_level
                                )}
                                {" "}
                                {item.risk_level ||
                                  "Unknown"}
                              </span>

                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </>

          )}

        </section>
      )}

      {/* =====================================================
          FOOTER
          ===================================================== */}

      <footer className="footer">

        <div className="footer-brand">

          <div className="footer-logo">
            V
          </div>

          <div>
            <strong>
              VOXSHIELD AI
            </strong>

            <p>
              AI-powered voice security
              and fraud prevention.
            </p>
          </div>

        </div>

        <div className="footer-tech">

          <span>
            REACT
          </span>

          <span>
            FASTAPI
          </span>

          <span>
            MACHINE LEARNING
          </span>

          <span>
            FIREBASE
          </span>

        </div>

        <div className="footer-disclaimer">

          ⚠️ VoxShield AI provides an additional
          security signal and should not be treated
          as definitive proof of voice authenticity.

        </div>

      </footer>

    </div>
  );
}

export default App;