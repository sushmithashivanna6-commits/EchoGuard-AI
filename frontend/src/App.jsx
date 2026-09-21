import { useEffect, useRef, useState } from "react";
import { db, auth } from "./firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import "./App.css";

const API = "http://127.0.0.1:8000";

/* =========================================================
   AUDIO HELPERS
========================================================= */

function getAudioContext() {
  const Ctx =
    window.AudioContext ||
    window.webkitAudioContext;

  return Ctx ? new Ctx() : null;
}

/* =========================================================
   LIVE WAVEFORM
========================================================= */

function WaveCanvas({
  stream,
  active = false,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let raf;
    let audioContext;
    let analyser;
    let source;
    let data;

    const resize = () => {
      const dpr =
        window.devicePixelRatio || 1;

      canvas.width =
        canvas.clientWidth * dpr;

      canvas.height =
        canvas.clientHeight * dpr;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    };

    resize();
    window.addEventListener(
      "resize",
      resize
    );

    if (stream && active) {
      try {
        audioContext = getAudioContext();

        if (audioContext) {
          analyser =
            audioContext.createAnalyser();

          analyser.fftSize = 2048;

          source =
            audioContext.createMediaStreamSource(
              stream
            );

          source.connect(analyser);

          data =
            new Uint8Array(
              analyser.fftSize
            );
        }
      } catch (e) {
        console.error(e);
      }
    }

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.clearRect(
        0,
        0,
        w,
        h
      );

      ctx.strokeStyle =
        "rgba(70,220,255,.12)";
      ctx.lineWidth = 1;

      for (
        let y = 0;
        y < h;
        y += 28
      ) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.shadowBlur = 18;
      ctx.shadowColor =
        "rgba(0,220,255,.9)";

      if (analyser && data) {
        analyser.getByteTimeDomainData(
          data
        );

        for (
          let i = 0;
          i < data.length;
          i++
        ) {
          const x =
            (i /
              (data.length - 1)) *
            w;

          const y =
            h / 2 +
            ((data[i] - 128) /
              128) *
              h *
              0.4;

          if (i === 0)
            ctx.moveTo(x, y);
          else
            ctx.lineTo(x, y);
        }
      } else {
        const t =
          Date.now() / 500;

        for (
          let i = 0;
          i <= 140;
          i++
        ) {
          const x =
            (i / 140) * w;

          const envelope = active
            ? 0.28 +
              0.18 *
                Math.sin(
                  t + i * 0.07
                )
            : 0.1;

          const y =
            h / 2 +
            Math.sin(
              i * 0.34 + t
            ) *
              h *
              envelope *
              0.45;

          if (i === 0)
            ctx.moveTo(x, y);
          else
            ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      raf =
        requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);

      window.removeEventListener(
        "resize",
        resize
      );

      try {
        source?.disconnect();
      } catch {}

      try {
        audioContext?.close();
      } catch {}
    };
  }, [stream, active]);

  return (
    <canvas
      ref={canvasRef}
      className="wave-canvas"
    />
  );
}

/* =========================================================
   LIVE FREQUENCY
========================================================= */

function FrequencyCanvas({
  stream,
  active = false,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let raf;
    let audioContext;
    let analyser;
    let source;
    let data;

    const resize = () => {
      const dpr =
        window.devicePixelRatio || 1;

      canvas.width =
        canvas.clientWidth * dpr;

      canvas.height =
        canvas.clientHeight * dpr;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    };

    resize();

    if (stream && active) {
      try {
        audioContext = getAudioContext();

        if (audioContext) {
          analyser =
            audioContext.createAnalyser();

          analyser.fftSize = 2048;

          source =
            audioContext.createMediaStreamSource(
              stream
            );

          source.connect(analyser);

          data =
            new Uint8Array(
              analyser.frequencyBinCount
            );
        }
      } catch {}
    }

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.clearRect(
        0,
        0,
        w,
        h
      );

      ctx.strokeStyle =
        "rgba(100,220,255,.12)";

      for (
        let y = 0;
        y < h;
        y += 30
      ) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (analyser && data) {
        analyser.getByteFrequencyData(
          data
        );

        const bars = 80;
        const step =
          Math.max(
            1,
            Math.floor(
              data.length / bars
            )
          );

        const barWidth =
          w / bars;

        for (
          let i = 0;
          i < bars;
          i++
        ) {
          const value =
            data[i * step] || 0;

          const barHeight =
            (value / 255) *
            h *
            0.9;

          ctx.fillStyle =
            `rgba(65,220,255,${
              0.25 +
              value / 400
            })`;

          ctx.fillRect(
            i * barWidth,
            h - barHeight,
            Math.max(
              2,
              barWidth - 2
            ),
            barHeight
          );
        }
      } else if (active) {
        const t =
          Date.now() / 400;

        for (
          let i = 0;
          i < 80;
          i++
        ) {
          const value =
            20 +
            Math.abs(
              Math.sin(
                i * 0.35 + t
              )
            ) *
              100;

          const barHeight =
            (value / 255) *
            h *
            0.8;

          ctx.fillStyle =
            "rgba(65,220,255,.45)";

          ctx.fillRect(
            i * (w / 80),
            h - barHeight,
            w / 80 - 2,
            barHeight
          );
        }
      }

      raf =
        requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);

      try {
        source?.disconnect();
      } catch {}

      try {
        audioContext?.close();
      } catch {}
    };
  }, [stream, active]);

  return (
    <canvas
      ref={canvasRef}
      className="frequency-canvas"
    />
  );
}

/* =========================================================
   FFT
========================================================= */

function fft(real, imag) {
  const n = real.length;

  let j = 0;

  for (
    let i = 1;
    i < n;
    i++
  ) {
    let bit =
      n >> 1;

    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }

    j ^= bit;

    if (i < j) {
      [
        real[i],
        real[j],
      ] = [
        real[j],
        real[i],
      ];

      [
        imag[i],
        imag[j],
      ] = [
        imag[j],
        imag[i],
      ];
    }
  }

  for (
    let len = 2;
    len <= n;
    len <<= 1
  ) {
    const angle =
      (-2 * Math.PI) / len;

    const wlenR =
      Math.cos(angle);

    const wlenI =
      Math.sin(angle);

    for (
      let i = 0;
      i < n;
      i += len
    ) {
      let wr = 1;
      let wi = 0;

      for (
        let j = 0;
        j < len / 2;
        j++
      ) {
        const uR =
          real[i + j];

        const uI =
          imag[i + j];

        const vR =
          real[
            i +
              j +
              len / 2
          ] *
          wr -
          imag[
            i +
              j +
              len / 2
          ] *
            wi;

        const vI =
          real[
            i +
              j +
              len / 2
          ] *
            wi +
          imag[
            i +
              j +
              len / 2
          ] *
            wr;

        real[i + j] =
          uR + vR;

        imag[i + j] =
          uI + vI;

        real[
          i +
            j +
            len / 2
        ] =
          uR - vR;

        imag[
          i +
            j +
            len / 2
        ] =
          uI - vI;

        const nextWr =
          wr * wlenR -
          wi * wlenI;

        wi =
          wr * wlenI +
          wi * wlenR;

        wr = nextWr;
      }
    }
  }
}

/* =========================================================
   AUDIO FILE ANALYSIS
========================================================= */

function AudioFileAnalysis({
  file,
}) {
  const waveformRef =
    useRef(null);

  const frequencyRef =
    useRef(null);

  const spectrogramRef =
    useRef(null);

  const [audioUrl, setAudioUrl] =
    useState("");

  const [
    audioInfo,
    setAudioInfo,
  ] = useState(null);

  useEffect(() => {
    if (!file) {
      setAudioUrl("");
      setAudioInfo(null);
      return;
    }

    const url =
      URL.createObjectURL(file);

    setAudioUrl(url);

    let cancelled = false;

    async function decode() {
      try {
        const context =
          getAudioContext();

        if (!context) return;

        const buffer =
          await file.arrayBuffer();

        const audio =
          await context.decodeAudioData(
            buffer.slice(0)
          );

        if (cancelled) {
          context.close();
          return;
        }

        const channel =
          audio.getChannelData(0);

        const sampleRate =
          audio.sampleRate;

        setAudioInfo({
          duration:
            audio.duration,
          sampleRate,
          samples:
            channel.length,
        });

        drawWaveform(
          channel,
          waveformRef.current
        );

        drawFrequency(
          channel,
          sampleRate,
          frequencyRef.current
        );

        drawSpectrogram(
          channel,
          sampleRate,
          spectrogramRef.current
        );

        await context.close();
      } catch (e) {
        console.error(
          "Audio decode error:",
          e
        );
      }
    }

    decode();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="uploaded-analysis">
      <div className="uploaded-audio-header">
        <div>
          <div className="signal-label">
            AUDIO PLAYBACK
          </div>

          <b>
            {file?.name}
          </b>
        </div>

        {audioUrl && (
          <audio
            controls
            src={audioUrl}
            className="audio-player"
          />
        )}
      </div>

      {audioInfo && (
        <div className="audio-info-grid">
          <div>
            <small>
              Duration
            </small>

            <b>
              {audioInfo.duration.toFixed(
                2
              )} sec
            </b>
          </div>

          <div>
            <small>
              Sample Rate
            </small>

            <b>
              {audioInfo.sampleRate.toLocaleString()} Hz
            </b>
          </div>

          <div>
            <small>
              Samples
            </small>

            <b>
              {audioInfo.samples.toLocaleString()}
            </b>
          </div>
        </div>
      )}

      <div className="analysis-visual-card">
        <div className="signal-label">
          ACTUAL AUDIO WAVEFORM
        </div>

        <canvas
          ref={waveformRef}
          className="wave-canvas"
        />
      </div>

      <div className="analysis-visual-card">
        <div className="signal-label">
          FREQUENCY SPECTRUM
        </div>

        <canvas
          ref={frequencyRef}
          className="frequency-canvas"
        />
      </div>

      <div className="analysis-visual-card">
        <div className="signal-label">
          AUDIO SPECTROGRAM
        </div>

        <canvas
          ref={spectrogramRef}
          className="spectrogram-canvas"
        />
      </div>
    </div>
  );
}

/* =========================================================
   AUDIO DRAW FUNCTIONS
========================================================= */

function setupCanvas(canvas) {
  if (!canvas) return null;

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    canvas.clientWidth * dpr;

  canvas.height =
    canvas.clientHeight * dpr;

  const ctx =
    canvas.getContext("2d");

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  return ctx;
}

function drawWaveform(
  samples,
  canvas
) {
  const ctx =
    setupCanvas(canvas);

  if (!ctx) return;

  const w =
    canvas.clientWidth;

  const h =
    canvas.clientHeight;

  ctx.clearRect(
    0,
    0,
    w,
    h
  );

  ctx.strokeStyle =
    "rgba(70,220,255,.12)";

  for (
    let y = 0;
    y < h;
    y += 30
  ) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 10;
  ctx.shadowColor =
    "rgba(0,220,255,.8)";

  const step =
    Math.max(
      1,
      Math.floor(
        samples.length / w
      )
    );

  for (
    let x = 0;
    x < w;
    x++
  ) {
    const start =
      x * step;

    let min = 1;
    let max = -1;

    for (
      let i = 0;
      i < step &&
      start + i <
        samples.length;
      i++
    ) {
      const value =
        samples[start + i];

      if (value < min)
        min = value;

      if (value > max)
        max = value;
    }

    const y1 =
      h / 2 +
      min * h * 0.42;

    const y2 =
      h / 2 +
      max * h * 0.42;

    if (x === 0)
      ctx.moveTo(
        x,
        (y1 + y2) / 2
      );
    else
      ctx.lineTo(
        x,
        (y1 + y2) / 2
      );
  }

  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawFrequency(
  samples,
  sampleRate,
  canvas
) {
  const ctx =
    setupCanvas(canvas);

  if (!ctx) return;

  const w =
    canvas.clientWidth;

  const h =
    canvas.clientHeight;

  ctx.clearRect(
    0,
    0,
    w,
    h
  );

  const size = 2048;

  const real =
    new Array(size).fill(0);

  const imag =
    new Array(size).fill(0);

  const center =
    Math.floor(
      samples.length / 2
    );

  const start =
    Math.max(
      0,
      center - size / 2
    );

  for (
    let i = 0;
    i < size;
    i++
  ) {
    const index =
      start + i;

    const sample =
      index <
      samples.length
        ? samples[index]
        : 0;

    const window =
      0.5 -
      0.5 *
        Math.cos(
          (2 * Math.PI * i) /
            (size - 1)
        );

    real[i] =
      sample * window;
  }

  fft(real, imag);

  const bins =
    size / 2;

  const values =
    new Array(bins);

  let max = 0;

  for (
    let i = 0;
    i < bins;
    i++
  ) {
    const magnitude =
      Math.sqrt(
        real[i] * real[i] +
          imag[i] * imag[i]
      );

    const db =
      20 *
      Math.log10(
        magnitude + 0.00001
      );

    values[i] = db;

    if (db > max)
      max = db;
  }

  ctx.strokeStyle =
    "rgba(70,220,255,.12)";

  for (
    let y = 0;
    y < h;
    y += 30
  ) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.lineWidth = 2;

  for (
    let i = 0;
    i < bins;
    i += 3
  ) {
    const x =
      (i / bins) * w;

    const normalized =
      Math.max(
        0,
        Math.min(
          1,
          (values[i] -
            (max - 80)) /
            80
        )
      );

    const y =
      h -
      normalized *
        h *
        0.9;

    if (i === 0)
      ctx.moveTo(x, y);
    else
      ctx.lineTo(x, y);
  }

  ctx.stroke();

  ctx.fillStyle =
    "rgba(150,230,255,.7)";

  ctx.font =
    "11px Arial";

  ctx.fillText(
    "0 Hz",
    5,
    h - 8
  );

  ctx.fillText(
    `${Math.round(
      sampleRate / 4
    )} Hz`,
    w / 2 - 30,
    h - 8
  );

  ctx.fillText(
    `${Math.round(
      sampleRate / 2
    )} Hz`,
    w - 70,
    h - 8
  );
}

function drawSpectrogram(
  samples,
  sampleRate,
  canvas
) {
  const ctx =
    setupCanvas(canvas);

  if (!ctx) return;

  const w =
    canvas.clientWidth;

  const h =
    canvas.clientHeight;

  ctx.fillStyle =
    "#07172e";

  ctx.fillRect(
    0,
    0,
    w,
    h
  );

  const fftSize = 1024;

  const frames = Math.min(
    160,
    Math.floor(
      Math.max(
        1,
        samples.length /
          512
      )
    )
  );

  const hop =
    Math.max(
      128,
      Math.floor(
        samples.length /
          frames
      )
    );

  for (
    let x = 0;
    x < frames;
    x++
  ) {
    const start =
      x * hop;

    const real =
      new Array(
        fftSize
      ).fill(0);

    const imag =
      new Array(
        fftSize
      ).fill(0);

    for (
      let i = 0;
      i < fftSize;
      i++
    ) {
      const index =
        start + i;

      if (
        index >=
        samples.length
      )
        break;

      const window =
        0.5 -
        0.5 *
          Math.cos(
            (2 *
              Math.PI *
              i) /
              (fftSize - 1)
          );

      real[i] =
        samples[index] *
        window;
    }

    fft(real, imag);

    const bins =
      fftSize / 2;

    for (
      let y = 0;
      y < bins;
      y += 2
    ) {
      const magnitude =
        Math.sqrt(
          real[y] *
            real[y] +
            imag[y] *
              imag[y]
        );

      const value =
        Math.min(
          1,
          Math.log10(
            1 +
              magnitude *
                100
          ) / 2
        );

      const px =
        (x / frames) *
        w;

      const py =
        h -
        (y / bins) *
          h;

      const hue =
        190 -
        value * 160;

      ctx.fillStyle =
        `hsla(${hue},90%,${
          35 +
          value * 45
        }%,${0.3 +
          value * 0.7})`;

      ctx.fillRect(
        px,
        py,
        w / frames + 1,
        Math.max(
          2,
          h / bins * 2
        )
      );
    }
  }

  ctx.strokeStyle =
    "rgba(80,220,255,.2)";

  for (
    let i = 1;
    i < 4;
    i++
  ) {
    const y =
      (i / 4) * h;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.fillStyle =
    "rgba(220,240,255,.7)";

  ctx.font =
    "11px Arial";

  ctx.fillText(
    "High frequency",
    8,
    16
  );

  ctx.fillText(
    "Low frequency",
    8,
    h - 8
  );
}

/* =========================================================
   STATIC / FALLBACK SPECTROGRAM
========================================================= */

function Spectrogram({
  active = false,
}) {
  const canvasRef =
    useRef(null);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    let raf;

    const draw = () => {
      const ctx =
        setupCanvas(canvas);

      if (!ctx) return;

      const w =
        canvas.clientWidth;

      const h =
        canvas.clientHeight;

      const t =
        Date.now() / 1000;

      ctx.fillStyle =
        "#07172e";

      ctx.fillRect(
        0,
        0,
        w,
        h
      );

      for (
        let x = 0;
        x < w;
        x += 4
      ) {
        for (
          let y = 0;
          y < h;
          y += 4
        ) {
          const wave =
            Math.sin(
              x * 0.055 +
                t *
                  (active
                    ? 2.2
                    : 0.7)
            ) +
            Math.sin(
              y * 0.12 - t
            ) +
            Math.sin(
              (x + y) *
                0.028
            );

          const intensity =
            Math.max(
              0,
              Math.min(
                1,
                (wave + 3) /
                  6
              )
            );

          const r =
            Math.round(
              20 +
                intensity *
                  190
            );

          const g =
            Math.round(
              70 +
                intensity *
                  100
            );

          const b =
            Math.round(
              140 +
                intensity *
                  100
            );

          ctx.fillStyle =
            `rgba(${r},${g},${b},${
              0.35 +
              intensity *
                0.55
            })`;

          ctx.fillRect(
            x,
            y,
            4,
            4
          );
        }
      }

      raf =
        requestAnimationFrame(
          draw
        );
    };

    draw();

    return () =>
      cancelAnimationFrame(
        raf
      );
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="spectrogram-canvas"
    />
  );
}

/* =========================================================
   ICON
========================================================= */

function Icon({ children }) {
  return (
    <span className="icon">
      {children}
    </span>
  );
}

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  const [
    activePage,
    setActivePage,
  ] = useState("dashboard");

  /* AUTH */

  const [
    currentUser,
    setCurrentUser,
  ] = useState(null);

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  const [
    authMode,
    setAuthMode,
  ] = useState("login");

  const [
    authName,
    setAuthName,
  ] = useState("");

  const [
    authEmail,
    setAuthEmail,
  ] = useState("");

  const [
    authPassword,
    setAuthPassword,
  ] = useState("");

  const [
    authError,
    setAuthError,
  ] = useState("");

  const [
    authBusy,
    setAuthBusy,
  ] = useState(false);

  /* THEME */

  const [
    theme,
    setTheme,
  ] = useState(
    () =>
      localStorage.getItem(
        "echoguard-theme"
      ) || "dark"
  );

  const [
    showUserMenu,
    setShowUserMenu,
  ] = useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    rememberMe,
    setRememberMe,
  ] = useState(true);

  const [
    globalSearch,
    setGlobalSearch,
  ] = useState("");

  /* AUDIO */

  const [
    audioFile,
    setAudioFile,
  ] = useState(null);

  const [
    referenceFile,
    setReferenceFile,
  ] = useState(null);

  const [
    isRecording,
    setIsRecording,
  ] = useState(false);

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] = useState(false);

  const [
    isRegistering,
    setIsRegistering,
  ] = useState(false);

  const [
    recordingStream,
    setRecordingStream,
  ] = useState(null);

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    history,
    setHistory,
  ] = useState([]);

  const mediaRecorderRef =
    useRef(null);

  const chunksRef =
    useRef([]);

  /* TRUSTED SPEAKER */

  const [
    referenceSpeakerRegistered,
    setReferenceSpeakerRegistered,
  ] = useState(false);

  const [
    speakerMessage,
    setSpeakerMessage,
  ] = useState("");

  /* HISTORY */

  const [
    historySearch,
    setHistorySearch,
  ] = useState("");

  const [
    historyFilter,
    setHistoryFilter,
  ] = useState("ALL");

  /* VERIFICATION */

  const [
    verificationData,
    setVerificationData,
  ] = useState(null);

  /* CALL SECURITY */

  const [
    callMonitoring,
    setCallMonitoring,
  ] = useState(false);

  const [
    callAnalyzing,
    setCallAnalyzing,
  ] = useState(false);

  const [
    callResult,
    setCallResult,
  ] = useState(null);

  const [
    callSeconds,
    setCallSeconds,
  ] = useState(0);

  const [
    callAlert,
    setCallAlert,
  ] = useState("");

  const [
    callStatus,
    setCallStatus,
  ] = useState(
    "Waiting for an incoming call"
  );

  const [
    callStream,
    setCallStream,
  ] = useState(null);

  const [
    incomingCall,
    setIncomingCall,
  ] = useState(false);

  const callStreamRef =
    useRef(null);

  const callRecorderRef =
    useRef(null);

  const callChunksRef =
    useRef([]);

  const callTimerRef =
    useRef(null);

  const callSegmentTimerRef =
    useRef(null);

  const callActiveRef =
    useRef(false);

  /* FRAUD REPORTS */

  const [
    fraudReports,
    setFraudReports,
  ] = useState([]);

  const [
    fraudReason,
    setFraudReason,
  ] = useState(
    "AI-generated / cloned voice"
  );

  const [
    fraudDescription,
    setFraudDescription,
  ] = useState("");

  const [
    fraudSubmitting,
    setFraudSubmitting,
  ] = useState(false);

  const [
    fraudMessage,
    setFraudMessage,
  ] = useState("");

  /* =========================================================
     AUTH LISTENER
  ========================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          setCurrentUser(user);
          setAuthLoading(false);

          if (user) {
            loadHistory();
            loadFraudReports();
            checkSpeakerReference();
          } else {
            setHistory([]);
            setFraudReports([]);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "echoguard-theme",
      theme
    );
  }, [theme]);

  useEffect(() => {
    const closeMenu = (e) => {
      if (
        !e.target.closest?.(
          ".user-menu-wrapper"
        )
      ) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener(
      "click",
      closeMenu
    );

    return () =>
      document.removeEventListener(
        "click",
        closeMenu
      );
  }, []);

  useEffect(() => {
    return () => {
      try {
        callRecorderRef.current?.stop();
      } catch {}

      clearInterval(
        callTimerRef.current
      );

      clearTimeout(
        callSegmentTimerRef.current
      );

      try {
        callStreamRef.current
          ?.getTracks()
          .forEach((track) =>
            track.stop()
          );
      } catch {}
    };
  }, []);

  /* =========================================================
     AUTH
  ========================================================= */

  async function handleAuthSubmit(e) {
    e.preventDefault();

    setAuthError("");

    if (
      !authEmail.trim() ||
      !authPassword
    ) {
      setAuthError(
        "Please enter your email and password."
      );
      return;
    }

    if (
      authMode === "signup" &&
      !authName.trim()
    ) {
      setAuthError(
        "Please enter your name."
      );
      return;
    }

    if (
      authMode === "signup" &&
      authPassword.length < 6
    ) {
      setAuthError(
        "Password should be at least 6 characters."
      );
      return;
    }

    setAuthBusy(true);

    try {
      await setPersistence(
        auth,
        rememberMe
          ? browserLocalPersistence
          : browserSessionPersistence
      );

      if (authMode === "signup") {
        const credential =
          await createUserWithEmailAndPassword(
            auth,
            authEmail.trim(),
            authPassword
          );

        await updateProfile(
          credential.user,
          {
            displayName:
              authName.trim(),
          }
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          authEmail.trim(),
          authPassword
        );
      }

      setAuthPassword("");
      setAuthError("");
    } catch (e) {
      console.error(e);

      const messages = {
        "auth/email-already-in-use":
          "This email is already registered. Please sign in.",
        "auth/invalid-email":
          "Please enter a valid email address.",
        "auth/weak-password":
          "Password should be at least 6 characters.",
        "auth/invalid-credential":
          "Email or password is incorrect.",
        "auth/user-not-found":
          "No account was found with this email.",
        "auth/wrong-password":
          "Email or password is incorrect.",
        "auth/operation-not-allowed":
          "Email/password login is not enabled in Firebase.",
        "auth/too-many-requests":
          "Too many attempts. Please wait.",
        "auth/network-request-failed":
          "Network error. Check your internet connection.",
      };

      setAuthError(
        messages[e?.code] ||
          e?.message ||
          "Authentication failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setAuthError("");
    setAuthBusy(true);

    try {
      await setPersistence(
        auth,
        rememberMe
          ? browserLocalPersistence
          : browserSessionPersistence
      );

      const provider =
        new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      await signInWithPopup(
        auth,
        provider
      );
    } catch (e) {
      setAuthError(
        e?.message ||
          "Google sign-in failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword() {
    setAuthError("");

    if (!authEmail.trim()) {
      setAuthError(
        "Enter your email first."
      );
      return;
    }

    try {
      await sendPasswordResetEmail(
        auth,
        authEmail.trim()
      );

      setAuthError(
        "Password reset email sent."
      );
    } catch (e) {
      setAuthError(
        e?.message ||
          "Unable to send reset email."
      );
    }
  }

  async function handleLogout() {
    try {
      stopCallMonitoring();
      await signOut(auth);
      setActivePage("dashboard");
      setResult(null);
      setAudioFile(null);
      setVerificationData(null);
      setShowUserMenu(false);
    } catch (e) {
      console.error(e);
    }
  }

  function toggleTheme() {
    setTheme((prev) =>
      prev === "dark"
        ? "light"
        : "dark"
    );
  }

  /* =========================================================
     FIREBASE HISTORY
  ========================================================= */

  async function loadHistory() {
    try {
      const q = query(
        collection(
          db,
          "detectionHistory"
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );

      const snap =
        await getDocs(q);

      setHistory(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (e) {
      console.error(e);
    }
  }

  /* =========================================================
     FRAUD REPORTS
  ========================================================= */

  async function loadFraudReports() {
    try {
      const snap =
        await getDocs(
          collection(
            db,
            "fraudReports"
          )
        );

      const data =
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

      data.sort(
        (a, b) => {
          const aa =
            a.createdAt?.seconds ||
            0;

          const bb =
            b.createdAt?.seconds ||
            0;

          return bb - aa;
        }
      );

      setFraudReports(data);
    } catch (e) {
      console.error(
        "Unable to load fraud reports:",
        e
      );
    }
  }

  async function submitFraudReport() {
    if (!currentUser) return;

    if (
      !fraudDescription.trim()
    ) {
      setFraudMessage(
        "Please describe why you believe this is fraud or a scam."
      );
      return;
    }

    setFraudSubmitting(true);
    setFraudMessage("");

    try {
      const evidence = result
        ? {
            status:
              result.status ||
              "",
            confidence:
              result.confidence ||
              0,
            risk_level:
              result.risk_level ||
              "",
            risk_score:
              result.risk_score ??
              null,
            filename:
              result.filename ||
              audioFile?.name ||
              "",
            risk_description:
              result.risk_description ||
              "",
          }
        : {
            filename:
              audioFile?.name ||
              "",
          };

      const report = {
        userId:
          currentUser.uid,

        reporterName:
          currentUser.displayName ||
          "Security User",

        reporterEmail:
          currentUser.email ||
          "",

        reason:
          fraudReason,

        description:
          fraudDescription.trim(),

        evidence,

        detectionId:
          result?.id || null,

        filename:
          audioFile?.name ||
          result?.filename ||
          "Unknown audio",

        status:
          "Submitted",

        createdAt:
          new Date(),

        updatedAt:
          new Date(),
      };

      const ref =
        await addDoc(
          collection(
            db,
            "fraudReports"
          ),
          report
        );

      setFraudReports(
        (prev) => [
          {
            ...report,
            id: ref.id,
          },
          ...prev,
        ]
      );

      setFraudDescription("");

      setFraudMessage(
        "Fraud report submitted successfully."
      );
    } catch (e) {
      console.error(e);

      setFraudMessage(
        `Unable to submit report: ${e.message}`
      );
    } finally {
      setFraudSubmitting(false);
    }
  }

  async function updateFraudStatus(
    id,
    status
  ) {
    try {
      await updateDoc(
        doc(
          db,
          "fraudReports",
          id
        ),
        {
          status,
          updatedAt:
            new Date(),
        }
      );

      setFraudReports(
        (prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status,
                }
              : x
          )
      );
    } catch (e) {
      console.error(e);
    }
  }

  /* =========================================================
     MICROPHONE
  ========================================================= */

  async function startRecording() {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia
      ) {
        alert(
          "Your browser does not support microphone recording."
        );
        return;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      setRecordingStream(stream);
      chunksRef.current = [];

      const recorder =
        new MediaRecorder(
          stream
        );

      mediaRecorderRef.current =
        recorder;

      recorder.ondataavailable =
        (e) => {
          if (e.data.size) {
            chunksRef.current.push(
              e.data
            );
          }
        };

      recorder.onstop = () => {
        const blob =
          new Blob(
            chunksRef.current,
            {
              type:
                recorder.mimeType ||
                "audio/webm",
            }
          );

        const file =
          new File(
            [blob],
            "Recorded Voice.webm",
            {
              type:
                recorder.mimeType ||
                "audio/webm",
            }
          );

        setAudioFile(file);
        setResult(null);
        setVerificationData(
          null
        );

        stream
          .getTracks()
          .forEach((t) =>
            t.stop()
          );

        setRecordingStream(null);
      };

      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);

      alert(
        e?.name ===
          "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in your browser."
          : "Microphone permission is required."
      );
    }
  }

  function stopRecording() {
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current
          .state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {}

    setIsRecording(false);
  }

  function handleAudio(e) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (
      file.size >
      50 * 1024 * 1024
    ) {
      alert(
        "Maximum audio size is 50 MB."
      );
      return;
    }

    setAudioFile(file);
    setResult(null);
    setVerificationData(
      null
    );
  }

  function handleReference(e) {
    const file =
      e.target.files?.[0];

    if (file)
      setReferenceFile(file);
  }

  /* =========================================================
     TRUSTED SPEAKER
  ========================================================= */

  async function checkSpeakerReference() {
    try {
      const r =
        await fetch(
          `${API}/speaker/status`
        );

      const data =
        await r.json();

      setReferenceSpeakerRegistered(
        data.registered ??
          data.reference_speaker_registered ??
          false
      );
    } catch {
      setReferenceSpeakerRegistered(
        false
      );
    }
  }

  async function registerSpeaker() {
    if (!referenceFile) {
      setSpeakerMessage(
        "Select a trusted speaker recording first."
      );
      return;
    }

    setIsRegistering(true);

    try {
      const fd =
        new FormData();

      fd.append(
        "file",
        referenceFile
      );

      const r =
        await fetch(
          `${API}/speaker/register`,
          {
            method: "POST",
            body: fd,
          }
        );

      const data =
        await r.json();

      if (!r.ok)
        throw new Error(
          data.detail ||
            "Registration failed"
        );

      setReferenceSpeakerRegistered(
        true
      );

      setReferenceFile(null);

      setSpeakerMessage(
        "Trusted speaker registered successfully."
      );
    } catch (e) {
      setSpeakerMessage(
        e.message
      );
    } finally {
      setIsRegistering(false);
    }
  }

  /* =========================================================
     VOICE DETECTION
  ========================================================= */

  async function analyzeVoice() {
    if (!audioFile) return;

    setIsAnalyzing(true);
    setResult(null);
    setVerificationData(null);

    try {
      const fd =
        new FormData();

      fd.append(
        "file",
        audioFile
      );

      const r =
        await fetch(
          `${API}/detect`,
          {
            method: "POST",
            body: fd,
          }
        );

      const data =
        await r.json();

      if (!r.ok)
        throw new Error(
          data.detail ||
            "Detection failed"
        );

      let verify = null;

      try {
        const vr =
          await fetch(
            `${API}/verify`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                {
                  risk_level:
                    data.risk_level,

                  confidence:
                    data.confidence,
                }
              ),
            }
          );

        verify =
          await vr.json();
      } catch {}

      setResult(data);
      setVerificationData(
        verify
      );

      /*
       IMPORTANT:
       EXISTING detectionHistory
       SCHEMA IS PRESERVED.
      */

      const historyData = {
        date: new Date().toLocaleString(),

        filename:
          data.filename ||
          audioFile.name,

        status:
          data.status,

        confidence:
          data.confidence,

        risk_level:
          data.risk_level ||
          "Unknown",

        risk_description:
          data.risk_description ||
          "",

        createdAt:
          new Date(),
      };

      await addDoc(
        collection(
          db,
          "detectionHistory"
        ),
        historyData
      );

      setHistory(
        (prev) => [
          {
            ...historyData,
            id: `local-${Date.now()}`,
          },
          ...prev,
        ]
      );
    } catch (e) {
      console.error(e);

      alert(
        `Analysis failed: ${e.message}`
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function startVerification() {
    if (!result) return;

    try {
      const r =
        await fetch(
          `${API}/verify`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              {
                risk_level:
                  result.risk_level,

                confidence:
                  result.confidence,
              }
            ),
          }
        );

      setVerificationData(
        await r.json()
      );
    } catch {
      alert(
        "Verification service is unavailable."
      );
    }
  }

  /* =========================================================
     DELETE HISTORY
  ========================================================= */

  async function deleteHistory(id) {
    if (
      !id ||
      id.startsWith("local-")
    ) {
      setHistory(
        (h) =>
          h.filter(
            (x) =>
              x.id !== id
          )
      );

      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          "detectionHistory",
          id
        )
      );

      setHistory(
        (h) =>
          h.filter(
            (x) =>
              x.id !== id
          )
      );
    } catch (e) {
      console.error(e);
    }
  }

  /* =========================================================
     CALL SECURITY
  ========================================================= */

  function riskClass(level) {
    const l =
      String(
        level || ""
      ).toUpperCase();

    if (l === "HIGH")
      return "danger";

    if (l === "MEDIUM")
      return "warning";

    if (l === "LOW")
      return "success";

    return "purple";
  }

  function showCallAlert(
    riskLevel,
    status,
    data
  ) {
    const level =
      String(
        riskLevel || ""
      ).toUpperCase();

    if (
      level === "HIGH" ||
      /ai|spoof|synthetic|clone|fake|possible/i.test(
        String(status)
      )
    ) {
      setCallAlert(
        "⚠ HIGH SECURITY ALERT — Possible AI-generated or cloned voice detected."
      );
    } else if (
      level === "MEDIUM"
    ) {
      setCallAlert(
        "⚠ VERIFICATION RECOMMENDED — Voice signals require additional verification."
      );
    } else if (
      level === "LOW"
    ) {
      setCallAlert(
        "✓ CALL APPEARS SAFE — No high-risk synthetic voice signal detected."
      );
    } else {
      setCallAlert(
        "◈ ANALYSIS COMPLETE — Continue monitoring the call."
      );
    }

    setCallResult(data);
  }

  async function analyzeCallSegment(
    blob
  ) {
    if (
      !blob ||
      !blob.size
    )
      return;

    setCallAnalyzing(true);

    try {
      const file =
        new File(
          [blob],
          `live-call-${Date.now()}.webm`,
          {
            type:
              blob.type ||
              "audio/webm",
          }
        );

      const fd =
        new FormData();

      fd.append(
        "file",
        file
      );

      const r =
        await fetch(
          `${API}/detect`,
          {
            method: "POST",
            body: fd,
          }
        );

      const data =
        await r.json();

      if (!r.ok)
        throw new Error(
          data.detail ||
            "Live detection failed"
        );

      showCallAlert(
        data.risk_level,
        data.status,
        data
      );

      setCallStatus(
        `Live analysis: ${
          data.status ||
          data.risk_level ||
          "Complete"
        }`
      );
    } catch (e) {
      setCallAlert(
        "⚠ Live detection service unavailable."
      );

      setCallStatus(
        "Monitoring audio — backend unavailable"
      );
    } finally {
      setCallAnalyzing(false);
    }
  }

  function startCallSegment() {
    if (
      !callActiveRef.current ||
      !callStreamRef.current
    )
      return;

    const stream =
      callStreamRef.current;

    let options = {};

    if (
      MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
    ) {
      options = {
        mimeType:
          "audio/webm;codecs=opus",
      };
    }

    try {
      const recorder =
        new MediaRecorder(
          stream,
          options
        );

      callRecorderRef.current =
        recorder;

      callChunksRef.current = [];

      recorder.ondataavailable =
        (e) => {
          if (e.data.size)
            callChunksRef.current.push(
              e.data
            );
        };

      recorder.onstop =
        async () => {
          const blob =
            new Blob(
              callChunksRef.current,
              {
                type:
                  recorder.mimeType ||
                  "audio/webm",
              }
            );

          if (
            callActiveRef.current
          ) {
            await analyzeCallSegment(
              blob
            );

            if (
              callActiveRef.current
            ) {
              startCallSegment();
            }
          }
        };

      recorder.start();

      callSegmentTimerRef.current =
        setTimeout(() => {
          try {
            if (
              recorder.state !==
              "inactive"
            )
              recorder.stop();
          } catch {}
        }, 5000);
    } catch (e) {
      console.error(e);
    }
  }

  async function startCallMonitoring() {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      callStreamRef.current =
        stream;

      setCallStream(stream);
      setCallMonitoring(true);
      setCallSeconds(0);
      setIncomingCall(false);

      callActiveRef.current =
        true;

      setCallAlert(
        "Live call protection is active."
      );

      setCallStatus(
        "Incoming call connected — monitoring voice"
      );

      callTimerRef.current =
        setInterval(() => {
          setCallSeconds(
            (x) => x + 1
          );
        }, 1000);

      startCallSegment();
    } catch (e) {
      alert(
        e?.name ===
          "NotAllowedError"
          ? "Microphone permission was denied."
          : "Microphone permission is required."
      );
    }
  }

  function simulateIncomingCall() {
    setIncomingCall(true);

    setCallStatus(
      "Incoming call detected — waiting for answer"
    );

    setCallAlert(
      "☎ Incoming call detected. Review caller verification."
    );
  }

  async function answerIncomingCall() {
    await startCallMonitoring();
  }

  function rejectIncomingCall() {
    setIncomingCall(false);
    setCallStatus(
      "Incoming call rejected"
    );

    setCallAlert(
      "✓ Call rejected."
    );
  }

  function stopCallMonitoring() {
    callActiveRef.current =
      false;

    clearInterval(
      callTimerRef.current
    );

    clearTimeout(
      callSegmentTimerRef.current
    );

    try {
      if (
        callRecorderRef.current &&
        callRecorderRef.current
          .state !== "inactive"
      ) {
        callRecorderRef.current.stop();
      }
    } catch {}

    try {
      callStreamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );
    } catch {}

    callRecorderRef.current =
      null;

    callStreamRef.current =
      null;

    setCallStream(null);
    setCallMonitoring(false);
    setCallAnalyzing(false);
    setCallSeconds(0);
    setIncomingCall(false);
    setCallStatus(
      "Waiting for an incoming call"
    );
    setCallAlert("");
  }

  function formatCallTime(
    seconds
  ) {
    return `${Math.floor(
      seconds / 60
    )
      .toString()
      .padStart(
        2,
        "0"
      )}:${(seconds % 60)
      .toString()
      .padStart(
        2,
        "0"
      )}`;
  }

  /* =========================================================
     DATA
  ========================================================= */

  const total =
    history.length;

  const humans =
    history.filter(
      (x) =>
        String(
          x.status
        )
          .toLowerCase()
          .includes("human")
    ).length;

  const spoof =
    history.filter(
      (x) =>
        /ai|spoof|possible|clone|fake/i.test(
          String(
            x.status
          )
        )
    ).length;

  const high =
    history.filter(
      (x) =>
        String(
          x.risk_level
        ).toUpperCase() ===
        "HIGH"
    ).length;

  const medium =
    history.filter(
      (x) =>
        String(
          x.risk_level
        ).toUpperCase() ===
        "MEDIUM"
    ).length;

  const low =
    history.filter(
      (x) =>
        String(
          x.risk_level
        ).toUpperCase() ===
        "LOW"
    ).length;

  const uncertain =
    history.filter(
      (x) =>
        String(
          x.risk_level
        ).toUpperCase() ===
        "UNCERTAIN"
    ).length;

  const avgConfidence =
    total
      ? (
          history.reduce(
            (sum, x) =>
              sum +
              Number(
                x.confidence ||
                  0
              ),
            0
          ) / total
        ).toFixed(1)
      : "0.0";

  const filteredHistory =
    history.filter((x) => {
      const text =
        `${x.filename || ""} ${
          x.status || ""
        } ${
          x.risk_level || ""
        }`.toLowerCase();

      return (
        text.includes(
          historySearch.toLowerCase()
        ) &&
        (historyFilter ===
          "ALL" ||
          String(
            x.risk_level
          ).toUpperCase() ===
            historyFilter)
      );
    });

  const suspiciousResult =
    result &&
    (
      String(
        result.risk_level
      ).toUpperCase() ===
        "HIGH" ||
      /ai|spoof|clone|fake|possible/i.test(
        String(
          result.status
        )
      )
    );

  const riskPercent =
    total
      ? {
          high: Math.round(
            (high / total) *
              100
          ),
          medium: Math.round(
            (medium / total) *
              100
          ),
          low: Math.round(
            (low / total) *
              100
          ),
          uncertain:
            Math.round(
              (uncertain /
                total) *
                100
            ),
        }
      : {
          high: 0,
          medium: 0,
          low: 0,
          uncertain: 0,
        };

  /* =========================================================
     NAVIGATION
  ========================================================= */

  const nav = [
    ["dashboard", "▦", "Dashboard"],
    ["detection", "◉", "Detection"],
    ["live", "⌁", "Live Monitor"],
    ["call", "☎", "Call Security"],
    ["history", "◷", "History"],
    ["fraud", "🚨", "Fraud Reports"],
    ["trusted", "♟", "Trusted Speakers"],
    ["analytics", "▥", "Analytics"],
    ["reports", "▤", "Reports"],
    ["settings", "⚙", "Settings"],
    ["profile", "👤", "AI Security User"],
  ];

  /* =========================================================
     PANEL TITLE
  ========================================================= */

  function PanelTitle({
    icon,
    title,
    sub,
    right,
  }) {
    return (
      <div className="panel-title">
        <div>
          <span className="panel-icon">
            {icon}
          </span>

          <div>
            <b>{title}</b>

            {sub && (
              <small>{sub}</small>
            )}
          </div>
        </div>

        {right && (
          <span className="panel-right">
            {right}
          </span>
        )}
      </div>
    );
  }

  /* =========================================================
     DASHBOARD
  ========================================================= */

  function Dashboard() {
    return (
      <>
        <PageHeading
          eyebrow="VOICE SECURITY COMMAND CENTER"
          title={`Welcome back, ${
            currentUser?.displayName ||
            "User"
          } 👋`}
          text="Here's your voice security overview."
        />

        <div className="metrics-grid">
          <Metric
            icon="◉"
            label="Total Analyses"
            value={total}
            note="Firebase history"
          />

          <Metric
            icon="●"
            label="Human Voices"
            value={humans}
            note="Detected as human"
            tone="green"
          />

          <Metric
            icon="◈"
            label="AI / Spoof"
            value={spoof}
            note="Potential synthetic audio"
            tone="purple"
          />

          <Metric
            icon="!"
            label="High Risk"
            value={high}
            note="Requires attention"
            tone="pink"
          />
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <PanelTitle
              icon="◉"
              title="Detection Activity"
              sub="Recent confidence scores"
            />

            <div className="bar-chart">
              {history
                .slice(0, 12)
                .reverse()
                .map(
                  (x, i) => (
                    <div
                      className="bar-wrap"
                      key={
                        x.id ||
                        i
                      }
                    >
                      <span>
                        {Number(
                          x.confidence ||
                            0
                        ).toFixed(
                          0
                        )}
                        %
                      </span>

                      <div
                        className="bar"
                        style={{
                          height: `${Math.max(
                            12,
                            Number(
                              x.confidence ||
                                0
                            )
                          )}%`,
                        }}
                      />

                      <small>
                        {i + 1}
                      </small>
                    </div>
                  )
                )}

              {!history.length && (
                <div className="empty">
                  No analyses yet.
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <PanelTitle
              icon="◈"
              title="Risk Distribution"
              sub="Current history"
            />

            <div className="risk-content">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(
                    #ff2d77 0 ${riskPercent.high}%,
                    #ffad20 ${riskPercent.high}% ${
                      riskPercent.high +
                      riskPercent.medium
                    }%,
                    #16e0a0 ${
                      riskPercent.high +
                      riskPercent.medium
                    }% ${
                      riskPercent.high +
                      riskPercent.medium +
                      riskPercent.low
                    }%,
                    #9b5cff ${
                      riskPercent.high +
                      riskPercent.medium +
                      riskPercent.low
                    }% 100%
                  )`,
                }}
              >
                <div>
                  <b>{total}</b>
                  <span>Total</span>
                </div>
              </div>

              <div className="legend">
                <Legend
                  color="pink"
                  label="High"
                  value={high}
                />
                <Legend
                  color="orange"
                  label="Medium"
                  value={medium}
                />
                <Legend
                  color="green"
                  label="Low"
                  value={low}
                />
                <Legend
                  color="purple"
                  label="Uncertain"
                  value={uncertain}
                />
              </div>
            </div>
          </section>

          <section className="panel">
            <PanelTitle
              icon="◉"
              title="Live Voice Analysis"
              sub="Microphone signal monitor"
              right="● Real-time"
            />

            <WaveCanvas
              stream={
                recordingStream
              }
              active={
                isRecording
              }
            />

            <FrequencyCanvas
              stream={
                recordingStream
              }
              active={
                isRecording
              }
            />
          </section>

          <section className="panel">
            <PanelTitle
              icon="▦"
              title="Spectrogram View"
              sub="Audio frequency map"
            />

            <Spectrogram
              active={
                isRecording
              }
            />
          </section>

          <section className="panel">
            <PanelTitle
              icon="✦"
              title="Quick Actions"
            />

            <div className="quick-actions">
              <button
                onClick={() => {
                  setActivePage(
                    "detection"
                  );
                  startRecording();
                }}
              >
                🎙
                <b>Record Voice</b>
              </button>

              <button
                onClick={() =>
                  setActivePage(
                    "detection"
                  )
                }
              >
                ☁
                <b>Upload Audio</b>
              </button>

              <button
                onClick={() =>
                  setActivePage(
                    "trusted"
                  )
                }
              >
                ♟
                <b>Register Speaker</b>
              </button>

              <button
                onClick={() =>
                  setActivePage(
                    "call"
                  )
                }
              >
                ☎
                <b>Call Security</b>
              </button>

              <button
                onClick={() =>
                  setActivePage(
                    "fraud"
                  )
                }
              >
                🚨
                <b>Report Fraud</b>
              </button>
            </div>
          </section>

          <section className="panel">
            <PanelTitle
              icon="▥"
              title="Quick Stats"
            />

            <StatRow
              label="Average Confidence"
              value={`${avgConfidence}%`}
            />

            <StatRow
              label="High Risk"
              value={high}
            />

            <StatRow
              label="Fraud Reports"
              value={
                fraudReports.length
              }
            />

            <StatRow
              label="Trusted Speaker"
              value={
                referenceSpeakerRegistered
                  ? "ACTIVE"
                  : "NONE"
              }
            />
          </section>
        </div>
      </>
    );
  }

  /* =========================================================
     DETECTION
  ========================================================= */

  function Detection() {
    return (
      <>
        <PageHeading
          eyebrow="REAL-TIME VOICE PROTECTION"
          title="Voice Detection"
          text="Analyze acoustic, spectral and speaker-consistency signals."
        />

        <section className="panel">
          <PanelTitle
            icon="♟"
            title="Trusted Speaker"
            sub={
              referenceSpeakerRegistered
                ? "Reference fingerprint is active"
                : "Register a trusted reference voice"
            }
            right={
              referenceSpeakerRegistered
                ? "● ACTIVE"
                : "NOT REGISTERED"
            }
          />

          <div className="reference-row">
            <label className="upload-mini">
              <input
                type="file"
                accept="audio/*"
                onChange={
                  handleReference
                }
              />
              <span>
                ＋ Select trusted voice
              </span>
            </label>

            <button
              className="primary-btn"
              disabled={
                !referenceFile ||
                isRegistering
              }
              onClick={
                registerSpeaker
              }
            >
              {isRegistering
                ? "REGISTERING..."
                : "REGISTER SPEAKER"}
            </button>
          </div>

          {speakerMessage && (
            <p className="speaker-message">
              {speakerMessage}
            </p>
          )}
        </section>

        <div className="detection-layout">
          <section className="panel detection-main">
            <PanelTitle
              icon="◉"
              title="Voice Input"
              sub="Record live audio or upload a recording"
            />

            <div className="record-box">
              <div
                className={`big-mic ${
                  isRecording
                    ? "recording"
                    : ""
                }`}
              >
                🎙
              </div>

              <h2>
                {isRecording
                  ? "Listening to your voice..."
                  : "Ready for secure analysis"}
              </h2>

              <p>
                MP3, WAV, M4A, FLAC
                or WebM · Max 50 MB
              </p>

              {!isRecording ? (
                <button
                  className="primary-btn large"
                  onClick={
                    startRecording
                  }
                >
                  ● START RECORDING
                </button>
              ) : (
                <button
                  className="danger-btn large"
                  onClick={
                    stopRecording
                  }
                >
                  ■ STOP RECORDING
                </button>
              )}

              <div className="or">
                OR
              </div>

              <label className="upload-large">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={
                    handleAudio
                  }
                />
                <span>
                  ☁ Upload audio file
                </span>
              </label>
            </div>

            {audioFile && (
              <>
                <div className="selected-file">
                  <div>
                    <Icon>♫</Icon>

                    <div>
                      <b>
                        {audioFile.name}
                      </b>

                      <small>
                        {(
                          audioFile.size /
                          1024 /
                          1024
                        ).toFixed(
                          2
                        )}{" "}
                        MB
                      </small>
                    </div>
                  </div>

                  <button
                    className="primary-btn"
                    onClick={
                      analyzeVoice
                    }
                    disabled={
                      isAnalyzing
                    }
                  >
                    {isAnalyzing
                      ? "ANALYZING..."
                      : "ANALYZE VOICE"}
                  </button>
                </div>

                {/* NEW:
                    PLAYBACK + ACTUAL
                    WAVEFORM +
                    FREQUENCY +
                    SPECTROGRAM
                */}
                <AudioFileAnalysis
                  file={audioFile}
                />
              </>
            )}

            {!audioFile && (
              <div className="signal-preview">
                <div className="signal-label">
                  LIVE VOICE WAVEFORM
                </div>

                <WaveCanvas
                  stream={
                    recordingStream
                  }
                  active={
                    isRecording
                  }
                />

                <div className="signal-label">
                  LIVE FREQUENCY
                </div>

                <FrequencyCanvas
                  stream={
                    recordingStream
                  }
                  active={
                    isRecording
                  }
                />
              </div>
            )}
          </section>

          <section className="panel result-panel">
            <PanelTitle
              icon="◈"
              title="Security Result"
              sub="Multi-signal decision"
            />

            {!result ? (
              <div className="result-empty">
                <div className="shield-3d">
                  ⬡
                </div>

                <b>
                  Awaiting analysis
                </b>

                <span>
                  Analyze an audio file
                  to see the AI detection
                  result.
                </span>
              </div>
            ) : (
              <>
                <div
                  className={`result-banner ${riskClass(
                    result.risk_level
                  )}`}
                >
                  <span>
                    {result.status ||
                      "Analysis complete"}
                  </span>

                  <b>
                    {Number(
                      result.confidence ||
                        0
                    ).toFixed(
                      0
                    )}
                    %
                  </b>
                </div>

                <div className="result-grid">
                  <ResultMetric
                    label="Risk Score"
                    value={Number(
                      result.risk_score ??
                        result.confidence ??
                        0
                    ).toFixed(
                      0
                    )}
                  />

                  <ResultMetric
                    label="Risk Level"
                    value={
                      result.risk_level ||
                      "UNKNOWN"
                    }
                  />

                  <ResultMetric
                    label="Action"
                    value={
                      result.security_action ||
                      "REVIEW"
                    }
                  />
                </div>

                <div className="analysis-signals">
                  <div className="mini-title">
                    ANALYSIS SIGNALS
                  </div>

                  <SignalRow
                    label="AI acoustic / spectral detection"
                  />

                  <SignalRow
                    label="Pitch & prosody analysis"
                  />

                  <SignalRow
                    label="Silence / speech activity"
                  />

                  <SignalRow
                    label="Energy variation"
                  />

                  <SignalRow
                    label="Speaker consistency"
                  />
                </div>

                {verificationData && (
                  <div className="verification-card">
                    <b>
                      SECONDARY VERIFICATION
                    </b>

                    <p>
                      {
                        verificationData.message
                      }
                    </p>
                  </div>
                )}

                <button
                  className="outline-btn full"
                  onClick={
                    startVerification
                  }
                >
                  RUN SECURITY
                  VERIFICATION
                </button>

                <button
                  className="danger-btn full"
                  onClick={() => {
                    setFraudMessage("");
                    setActivePage(
                      "fraud"
                    );
                  }}
                >
                  🚨 REPORT AS FRAUD / SCAM
                </button>

                {suspiciousResult && (
                  <div className="fraud-warning">
                    ⚠ This detection has
                    suspicious AI/cloning
                    indicators. Review it
                    and submit a fraud report
                    if appropriate.
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </>
    );
  }

  /* =========================================================
     FRAUD REPORT PAGE
  ========================================================= */

  function FraudReportsPage() {
    return (
      <>
        <PageHeading
          eyebrow="FRAUD RESPONSE CENTER"
          title="Fraud Reports 🚨"
          text="Report suspicious voice activity and track investigation status."
        />

        <div className="fraud-layout">
          <section className="panel">
            <PanelTitle
              icon="🚨"
              title="Report Voice Fraud"
              sub="Submit evidence for a suspicious call or audio recording"
            />

            {result && (
              <div className="fraud-evidence">
                <b>
                  DETECTION EVIDENCE
                </b>

                <p>
                  File:{" "}
                  {audioFile?.name ||
                    result.filename ||
                    "Unknown"}
                </p>

                <p>
                  Result:{" "}
                  {result.status ||
                    "Unknown"}
                </p>

                <p>
                  Risk:{" "}
                  {result.risk_level ||
                    "Unknown"}
                </p>

                <p>
                  Confidence:{" "}
                  {Number(
                    result.confidence ||
                      0
                  ).toFixed(
                    0
                  )}
                  %
                </p>
              </div>
            )}

            <label className="form-label">
              Fraud type
            </label>

            <select
              value={
                fraudReason
              }
              onChange={(e) =>
                setFraudReason(
                  e.target.value
                )
              }
            >
              <option>
                AI-generated / cloned voice
              </option>
              <option>
                Impersonation scam
              </option>
              <option>
                Financial fraud attempt
              </option>
              <option>
                Fake customer support
              </option>
              <option>
                Identity verification fraud
              </option>
              <option>
                Other suspicious activity
              </option>
            </select>

            <label className="form-label">
              Description
            </label>

            <textarea
              rows="6"
              value={
                fraudDescription
              }
              onChange={(e) =>
                setFraudDescription(
                  e.target.value
                )
              }
              placeholder="Describe what happened, what the caller requested, and why you believe it was fraudulent..."
            />

            <button
              className="danger-btn large"
              disabled={
                fraudSubmitting
              }
              onClick={
                submitFraudReport
              }
            >
              {fraudSubmitting
                ? "SUBMITTING..."
                : "🚨 SUBMIT FRAUD REPORT"}
            </button>

            {fraudMessage && (
              <div className="fraud-message">
                {fraudMessage}
              </div>
            )}
          </section>

          <section className="panel">
            <PanelTitle
              icon="◷"
              title="Report Status"
              sub="Track submitted fraud reports"
            />

            {!fraudReports.length ? (
              <div className="empty">
                No fraud reports submitted
                yet.
              </div>
            ) : (
              <div className="fraud-list">
                {fraudReports.map(
                  (report) => (
                    <div
                      className="fraud-card"
                      key={
                        report.id
                      }
                    >
                      <div className="fraud-card-top">
                        <b>
                          {report.reason}
                        </b>

                        <span
                          className={`tag ${riskClass(
                            report.status ===
                              "Resolved"
                              ? "LOW"
                              : report.status ===
                                "Under Review"
                              ? "MEDIUM"
                              : "HIGH"
                          )}`}
                        >
                          {
                            report.status
                          }
                        </span>
                      </div>

                      <p>
                        {
                          report.description
                        }
                      </p>

                      <small>
                        File:{" "}
                        {
                          report.filename
                        }
                      </small>

                      <div className="fraud-status">
                        <span
                          className={
                            report.status ===
                            "Submitted"
                              ? "active"
                              : ""
                          }
                        >
                          1. Submitted
                        </span>

                        <span
                          className={
                            report.status ===
                            "Under Review"
                              ? "active"
                              : ""
                          }
                        >
                          2. Under Review
                        </span>

                        <span
                          className={
                            report.status ===
                            "Resolved"
                              ? "active"
                              : ""
                          }
                        >
                          3. Resolved
                        </span>
                      </div>

                      <div className="fraud-buttons">
                        <button
                          onClick={() =>
                            updateFraudStatus(
                              report.id,
                              "Under Review"
                            )
                          }
                        >
                          Under Review
                        </button>

                        <button
                          onClick={() =>
                            updateFraudStatus(
                              report.id,
                              "Resolved"
                            )
                          }
                        >
                          Mark Resolved
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  /* =========================================================
     CALL PAGE
  ========================================================= */

  function CallSecurityPage() {
    return (
      <>
        <PageHeading
          eyebrow="INCOMING CALL PROTECTION"
          title="Call Security"
          text="Continuously check live voice segments for possible synthetic or cloned speech."
        />

        {!callMonitoring &&
          !incomingCall && (
            <section className="panel incoming-call-panel">
              <PanelTitle
                icon="☎"
                title="Incoming Call Simulator"
                sub="Prototype mode for browser / VoIP testing"
              />

              <div className="incoming-call-content">
                <div className="caller-orb">
                  ☎
                </div>

                <div>
                  <h2>
                    Unknown / External
                    Caller
                  </h2>

                  <p>
                    Simulate an incoming
                    call and activate
                    EchoGuard AI protection.
                  </p>
                </div>

                <button
                  className="primary-btn large"
                  onClick={
                    simulateIncomingCall
                  }
                >
                  ☎ SIMULATE INCOMING CALL
                </button>
              </div>
            </section>
          )}

        {incomingCall &&
          !callMonitoring && (
            <section className="panel incoming-call-active">
              <div className="incoming-ring">
                ☎
              </div>

              <div>
                <h2>
                  Caller verification
                  required
                </h2>

                <p>
                  Review the caller before
                  sensitive actions.
                </p>
              </div>

              <div className="incoming-actions">
                <button
                  className="danger-btn"
                  onClick={
                    rejectIncomingCall
                  }
                >
                  ✕ REJECT
                </button>

                <button
                  className="primary-btn"
                  onClick={
                    answerIncomingCall
                  }
                >
                  ✓ ANSWER & MONITOR
                </button>
              </div>
            </section>
          )}

        <section className="panel">
          <PanelTitle
            icon="◉"
            title="Live Call Security Monitor"
            sub="5-second voice segment analysis"
            right={
              callMonitoring
                ? "● LIVE"
                : "STANDBY"
            }
          />

          <div className="call-monitor-grid">
            <div className="call-main-visual">
              <div
                className={`call-orb ${
                  callMonitoring
                    ? "active"
                    : ""
                }`}
              >
                {callMonitoring
                  ? "🎙"
                  : "☎"}
              </div>

              <div className="call-timer">
                {formatCallTime(
                  callSeconds
                )}
              </div>

              <b>
                {callMonitoring
                  ? "Voice protection active"
                  : "Call monitoring ready"}
              </b>

              <small>
                {callStatus}
              </small>
            </div>

            <div className="call-wave-box">
              <div className="signal-label">
                LIVE WAVEFORM
              </div>

              <WaveCanvas
                stream={
                  callStream
                }
                active={
                  callMonitoring
                }
              />

              <div className="signal-label">
                LIVE FREQUENCY
              </div>

              <FrequencyCanvas
                stream={
                  callStream
                }
                active={
                  callMonitoring
                }
              />
            </div>
          </div>

          {!callMonitoring ? (
            <button
              className="primary-btn large"
              onClick={
                startCallMonitoring
              }
            >
              🎙 START CALL MONITORING
            </button>
          ) : (
            <button
              className="danger-btn large"
              onClick={
                stopCallMonitoring
              }
            >
              ■ END CALL & STOP SECURITY
            </button>
          )}
        </section>

        <div className="call-security-grid">
          <section className="panel">
            <PanelTitle
              icon="◈"
              title="Security Analysis"
            />

            {callAnalyzing && (
              <div className="empty">
                Analyzing latest voice
                segment...
              </div>
            )}

            {!callAnalyzing &&
              !callResult && (
                <div className="result-empty">
                  <div className="shield-3d">
                    ⬡
                  </div>

                  <b>
                    Waiting for live
                    analysis
                  </b>
                </div>
              )}

            {callResult && (
              <>
                <div
                  className={`result-banner ${riskClass(
                    callResult.risk_level
                  )}`}
                >
                  <span>
                    {
                      callResult.status
                    }
                  </span>

                  <b>
                    {Number(
                      callResult.confidence ||
                        0
                    ).toFixed(
                      0
                    )}
                    %
                  </b>
                </div>

                <p>
                  {callResult.risk_description ||
                    "Live analysis complete."}
                </p>

                <button
                  className="danger-btn full"
                  onClick={() =>
                    setActivePage(
                      "fraud"
                    )
                  }
                >
                  🚨 REPORT CALL AS FRAUD
                </button>
              </>
            )}
          </section>

          <section className="panel">
            <PanelTitle
              icon="!"
              title="Security Alert"
            />

            <div className="call-alert-box">
              <div className="alert-large-icon">
                🛡
              </div>

              <b>
                {callAlert ||
                  "No active security alert."}
              </b>

              <p>
                {callMonitoring
                  ? "EchoGuard AI is monitoring the live session."
                  : "Activate Call Security to begin."}
              </p>
            </div>
          </section>
        </div>
      </>
    );
  }

  /* =========================================================
     HISTORY
  ========================================================= */

  function HistoryPage() {
    return (
      <>
        <PageHeading
          eyebrow="AUDIT TRAIL"
          title="Detection History"
          text="Your existing Firebase detection history is preserved."
        />

        <section className="panel history-panel">
          <div className="history-tools">
            <input
              placeholder="Search filename, result, risk..."
              value={
                historySearch
              }
              onChange={(e) =>
                setHistorySearch(
                  e.target.value
                )
              }
            />

            {[
              "ALL",
              "HIGH",
              "MEDIUM",
              "LOW",
              "UNCERTAIN",
            ].map((x) => (
              <button
                key={x}
                className={
                  historyFilter ===
                  x
                    ? "filter-active"
                    : ""
                }
                onClick={() =>
                  setHistoryFilter(
                    x
                  )
                }
              >
                {x}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>FILE</th>
                  <th>RESULT</th>
                  <th>CONFIDENCE</th>
                  <th>RISK</th>
                  <th>DATE</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredHistory.map(
                  (x) => (
                    <tr
                      key={
                        x.id
                      }
                    >
                      <td>
                        {
                          x.filename
                        }
                      </td>

                      <td>
                        {
                          x.status
                        }
                      </td>

                      <td>
                        {Number(
                          x.confidence ||
                            0
                        ).toFixed(
                          0
                        )}
                        %
                      </td>

                      <td>
                        <span
                          className={`tag ${riskClass(
                            x.risk_level
                          )}`}
                        >
                          {
                            x.risk_level
                          }
                        </span>
                      </td>

                      <td>
                        {
                          x.date
                        }
                      </td>

                      <td>
                        <button
                          className="delete-btn"
                          onClick={() =>
                            deleteHistory(
                              x.id
                            )
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {!filteredHistory.length && (
            <div className="empty">
              No matching records.
            </div>
          )}
        </section>
      </>
    );
  }

  /* =========================================================
     TRUSTED
  ========================================================= */

  function TrustedPage() {
    return (
      <>
        <PageHeading
          eyebrow="IDENTITY ASSURANCE"
          title="Trusted Speakers"
          text="Register the trusted voice used for speaker consistency."
        />

        <section className="panel trusted-big">
          <div
            className={`trusted-orb ${
              referenceSpeakerRegistered
                ? "active"
                : ""
            }`}
          >
            ♟
          </div>

          <h2>
            {referenceSpeakerRegistered
              ? "Trusted speaker is active"
              : "No trusted speaker registered"}
          </h2>

          <p>
            Upload a clean reference
            recording to enable speaker
            consistency.
          </p>

          <label className="upload-large">
            <input
              type="file"
              accept="audio/*"
              onChange={
                handleReference
              }
            />

            <span>
              ☁ Select reference voice
            </span>
          </label>

          <button
            className="primary-btn"
            disabled={
              !referenceFile ||
              isRegistering
            }
            onClick={
              registerSpeaker
            }
          >
            {isRegistering
              ? "REGISTERING..."
              : "REGISTER TRUSTED SPEAKER"}
          </button>

          {speakerMessage && (
            <p>
              {speakerMessage}
            </p>
          )}
        </section>
      </>
    );
  }

  /* =========================================================
     PROFILE
  ========================================================= */

  function ProfilePage() {
    return (
      <>
        <PageHeading
          eyebrow="ACCOUNT"
          title="AI Security User"
          text="Your Firebase account information."
        />

        <section className="panel profile-card">
          <div className="profile-avatar-large">
            {(
              currentUser?.displayName ||
              currentUser?.email ||
              "U"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="profile-information">
            <div>
              <small>
                Firebase Name
              </small>

              <b>
                {currentUser?.displayName ||
                  "Security User"}
              </b>
            </div>

            <div>
              <small>
                Firebase Email
              </small>

              <b>
                {currentUser?.email ||
                  "No email available"}
              </b>
            </div>

            <div>
              <small>
                Authentication
              </small>

              <b>
                Firebase Authentication
              </b>
            </div>

            <div>
              <small>
                Account ID
              </small>

              <b>
                {currentUser?.uid}
              </b>
            </div>
          </div>

          <button
            className="danger-btn"
            onClick={
              handleLogout
            }
          >
            ↪ SIGN OUT
          </button>
        </section>
      </>
    );
  }

  /* =========================================================
     GENERIC
  ========================================================= */

  function GenericPage({
    title,
    eyebrow,
    children,
  }) {
    return (
      <>
        <PageHeading
          eyebrow={eyebrow}
          title={title}
          text="EchoGuard AI security workspace."
        />

        {children}
      </>
    );
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (authLoading) {
    return (
      <div className="auth-screen dark-theme">
        <div className="auth-loading-orb">
          ◈
        </div>

        <h2>
          EchoGuard AI
        </h2>

        <p>
          Loading secure workspace...
        </p>
      </div>
    );
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  if (!currentUser) {
    return (
      <div
        className={`auth-page ${
          theme === "light"
            ? "light-theme"
            : "dark-theme"
        }`}
      >
        <header className="vox-auth-topbar">
          <button
            className="vox-auth-brand"
            onClick={() =>
              setAuthMode(
                "login"
              )
            }
          >
            <span className="vox-brand-shield">
              〽
            </span>

            <span className="vox-brand-copy">
              <b>
                ECHOGUARD{" "}
                <em>AI</em>
              </b>

              <small>
                AI Voice Security
              </small>
            </span>
          </button>

          <button
            className="vox-auth-theme"
            onClick={
              toggleTheme
            }
          >
            {theme ===
            "dark"
              ? "☀"
              : "☾"}
          </button>
        </header>

        <main className="vox-auth-main">
          <section className="vox-auth-hero">
            <div className="vox-auth-badge">
              ● AI VOICE SECURITY
              PLATFORM
            </div>

            <h1>
              Detect. Verify.
              <br />
              <strong>
                Protect Every Voice.
              </strong>
            </h1>

            <p>
              EchoGuard AI analyzes
              voice signals for
              synthetic audio and
              impersonation risk.
            </p>

            <div className="vox-feature-row">
              <div className="vox-feature">
                〽
                <b>
                  AI / Spoof
                  <br />
                  Detection
                </b>
              </div>

              <i />

              <div className="vox-feature">
                ♙
                <b>
                  Speaker
                  <br />
                  Consistency
                </b>
              </div>

              <i />

              <div className="vox-feature">
                ♢
                <b>
                  Dynamic
                  <br />
                  Risk Analysis
                </b>
              </div>
            </div>
          </section>

          <section className="vox-login-card">
            <div className="vox-login-brand">
              <span className="vox-card-shield">
                〽
              </span>

              <span>
                <b>
                  ECHOGUARD{" "}
                  <em>AI</em>
                </b>

                <small>
                  AI Voice Security
                </small>
              </span>
            </div>

            <div className="vox-secure-label">
              ⌕ SECURE ACCESS
            </div>

            <h2>
              {authMode ===
              "login"
                ? "Welcome Back 👋"
                : "Create Account"}
            </h2>

            <p>
              {authMode ===
              "login"
                ? "Sign in to open your voice security dashboard."
                : "Create your secure EchoGuard AI account."}
            </p>

            <div className="vox-login-tabs">
              <button
                className={
                  authMode ===
                  "login"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setAuthMode(
                    "login"
                  )
                }
              >
                Sign In
              </button>

              <button
                className={
                  authMode ===
                  "signup"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setAuthMode(
                    "signup"
                  )
                }
              >
                Sign Up
              </button>
            </div>

            <form
              onSubmit={
                handleAuthSubmit
              }
              className="vox-login-form"
            >
              {authMode ===
                "signup" && (
                <input
                  value={
                    authName
                  }
                  onChange={(e) =>
                    setAuthName(
                      e.target.value
                    )
                  }
                  placeholder="Full name"
                />
              )}

              <input
                type="email"
                value={
                  authEmail
                }
                onChange={(e) =>
                  setAuthEmail(
                    e.target.value
                  )
                }
                placeholder="Email address"
              />

              <div className="password-wrap">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    authPassword
                  }
                  onChange={(e) =>
                    setAuthPassword(
                      e.target.value
                    )
                  }
                  placeholder="Password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (v) => !v
                    )
                  }
                >
                  {showPassword
                    ? "◉"
                    : "◌"}
                </button>
              </div>

              {authMode ===
                "login" && (
                <div className="vox-auth-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        rememberMe
                      }
                      onChange={(e) =>
                        setRememberMe(
                          e.target
                            .checked
                        )
                      }
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    onClick={
                      handleForgotPassword
                    }
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {authError && (
                <div className="vox-auth-message">
                  {authError}
                </div>
              )}

              <button
                className="vox-submit"
                disabled={
                  authBusy
                }
              >
                {authBusy
                  ? "PLEASE WAIT..."
                  : authMode ===
                    "login"
                  ? "Sign In →"
                  : "Create Account →"}
              </button>
            </form>

            <div className="vox-divider">
              OR
            </div>

            <button
              className="vox-google"
              onClick={
                handleGoogleSignIn
              }
            >
              <strong>G</strong>{" "}
              Continue with Google
            </button>

            <div className="vox-account-switch">
              {authMode ===
              "login"
                ? "Don't have an account?"
                : "Already have an account?"}

              <button
                onClick={() =>
                  setAuthMode(
                    authMode ===
                      "login"
                      ? "signup"
                      : "login"
                  )
                }
              >
                {authMode ===
                "login"
                  ? "Sign Up"
                  : "Sign In"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  /* =========================================================
     MAIN APPLICATION
  ========================================================= */

  return (
    <div
      className={`app-shell ${
        theme === "light"
          ? "light-theme"
          : "dark-theme"
      }`}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-shield">
            ◈
          </div>

          <div>
            <b>
              ECHOGUARD AI
            </b>

            <span>
              AI Voice Security
            </span>

            <small>
              Detect · Verify · Protect
            </small>
          </div>
        </div>

        <nav>
          {nav.map(
            ([
              id,
              icon,
              label,
            ]) => (
              <button
                key={id}
                className={
                  activePage ===
                  id
                    ? "nav-active"
                    : ""
                }
                onClick={() =>
                  setActivePage(
                    id
                  )
                }
              >
                <Icon>
                  {icon}
                </Icon>

                {label}
              </button>
            )
          )}
        </nav>

        <div className="safe-card">
          <b>
            🔒 Your voice data is
            safe
          </b>

          <p>
            Only metadata is stored
            in Firebase detection
            history.
          </p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search">
            <span>⌕</span>

            <input
              value={
                globalSearch
              }
              onChange={(e) =>
                setGlobalSearch(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key ===
                    "Enter" &&
                  globalSearch.trim()
                ) {
                  setHistorySearch(
                    globalSearch.trim()
                  );

                  setActivePage(
                    "history"
                  );
                }
              }}
              placeholder="Search by filename, result, risk..."
            />
          </div>

          <div className="top-actions">
            <span className="online">
              ● System Online
            </span>

            <button
              className="top-icon-btn"
              onClick={
                toggleTheme
              }
            >
              {theme ===
              "dark"
                ? "☼"
                : "☾"}
            </button>

            <div className="user-menu-wrapper">
              <button
                className="user-profile"
                onClick={(e) => {
                  e.stopPropagation();

                  setShowUserMenu(
                    (v) => !v
                  );
                }}
              >
                <div className="user-avatar">
                  AI
                </div>

                <span className="user-info">
                  <b>
                    Security User
                  </b>

                  <small>
                    Analyst
                  </small>
                </span>

                <span>
                  {showUserMenu
                    ? "⌃"
                    : "⌄"}
                </span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-title">
                    EchoGuard Account
                  </div>

                  <button
                    onClick={() =>
                      setActivePage(
                        "profile"
                      )
                    }
                  >
                    👤 AI Security User
                  </button>

                  <button
                    onClick={() =>
                      setActivePage(
                        "settings"
                      )
                    }
                  >
                    ⚙ Settings
                  </button>

                  <button
                    onClick={() =>
                      setActivePage(
                        "fraud"
                      )
                    }
                  >
                    🚨 Fraud Reports
                  </button>

                  <hr />

                  <button
                    className="logout-dropdown"
                    onClick={
                      handleLogout
                    }
                  >
                    ↪ Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          {activePage ===
            "dashboard" && (
            <Dashboard />
          )}

          {activePage ===
            "detection" && (
            <Detection />
          )}

          {activePage ===
            "live" && (
            <GenericPage
              title="Live Monitor"
              eyebrow="REAL-TIME STREAM"
            >
              <section className="panel">
                <PanelTitle
                  icon="◉"
                  title="Live Voice Monitor"
                  sub="Actual microphone waveform and frequency"
                  right="● ONLINE"
                />

                <WaveCanvas
                  stream={
                    recordingStream
                  }
                  active={
                    isRecording
                  }
                />

                <FrequencyCanvas
                  stream={
                    recordingStream
                  }
                  active={
                    isRecording
                  }
                />

                <Spectrogram
                  active={
                    isRecording
                  }
                />

                <button
                  className={
                    isRecording
                      ? "danger-btn large"
                      : "primary-btn large"
                  }
                  onClick={
                    isRecording
                      ? stopRecording
                      : startRecording
                  }
                >
                  {isRecording
                    ? "STOP LIVE MONITOR"
                    : "START LIVE MONITOR"}
                </button>
              </section>
            </GenericPage>
          )}

          {activePage ===
            "call" && (
            <CallSecurityPage />
          )}

          {activePage ===
            "history" && (
            <HistoryPage />
          )}

          {activePage ===
            "fraud" && (
            <FraudReportsPage />
          )}

          {activePage ===
            "trusted" && (
            <TrustedPage />
          )}

          {activePage ===
            "analytics" && (
            <GenericPage
              title="Security Analytics"
              eyebrow="ANALYTICS"
            >
              <div className="analytics-grid">
                <section className="panel">
                  <ResultMetric
                    label="Total analyses"
                    value={
                      total
                    }
                  />
                </section>

                <section className="panel">
                  <ResultMetric
                    label="AI / Spoof"
                    value={
                      spoof
                    }
                  />
                </section>

                <section className="panel">
                  <ResultMetric
                    label="Average confidence"
                    value={`${avgConfidence}%`}
                  />
                </section>

                <section className="panel">
                  <ResultMetric
                    label="High risk"
                    value={
                      high
                    }
                  />
                </section>

                <section className="panel">
                  <ResultMetric
                    label="Fraud reports"
                    value={
                      fraudReports.length
                    }
                  />
                </section>
              </div>
            </GenericPage>
          )}

          {activePage ===
            "reports" && (
            <GenericPage
              title="Security Reports"
              eyebrow="REPORT CENTER"
            >
              <section className="panel report-card">
                <h2>
                  EchoGuard AI Security
                  Report
                </h2>

                <p>
                  {total} voice analyses,
                  {high} high-risk
                  detections and{" "}
                  {
                    fraudReports.length
                  }{" "}
                  fraud reports are
                  currently recorded.
                </p>

                <button
                  className="primary-btn"
                  onClick={() =>
                    setActivePage(
                      "fraud"
                    )
                  }
                >
                  OPEN FRAUD REPORTS
                </button>
              </section>
            </GenericPage>
          )}

          {activePage ===
            "settings" && (
            <GenericPage
              title="System Settings"
              eyebrow="CONFIGURATION"
            >
              <section className="panel settings-card">
                <div>
                  <b>
                    FastAPI Analysis Service
                  </b>

                  <span>
                    {API}
                  </span>
                </div>

                <div>
                  <b>
                    Firebase Database
                  </b>

                  <span>
                    Existing
                    detectionHistory
                    collection
                  </span>
                </div>

                <div>
                  <b>
                    Trusted Speaker
                  </b>

                  <span>
                    {referenceSpeakerRegistered
                      ? "Registered"
                      : "Not registered"}
                  </span>
                </div>

                <div>
                  <b>
                    Appearance
                  </b>

                  <button
                    className="outline-btn"
                    onClick={
                      toggleTheme
                    }
                  >
                    {theme ===
                    "dark"
                      ? "SWITCH TO LIGHT"
                      : "SWITCH TO DARK"}
                  </button>
                </div>

                <div>
                  <b>
                    Profile
                  </b>

                  <button
                    className="outline-btn"
                    onClick={() =>
                      setActivePage(
                        "profile"
                      )
                    }
                  >
                    OPEN AI SECURITY USER
                  </button>
                </div>

                <div>
                  <b>
                    Fraud Reports
                  </b>

                  <button
                    className="outline-btn"
                    onClick={() =>
                      setActivePage(
                        "fraud"
                      )
                    }
                  >
                    OPEN FRAUD CENTER
                  </button>
                </div>

                <div>
                  <b>
                    Account
                  </b>

                  <button
                    className="danger-btn"
                    onClick={
                      handleLogout
                    }
                  >
                    ↪ LOG OUT
                  </button>
                </div>
              </section>
            </GenericPage>
          )}

          {activePage ===
            "profile" && (
            <ProfilePage />
          )}
        </div>

        <footer>
          EchoGuard AI{" "}
          <span>
            AI Voice Security Platform
          </span>

          <span>
            Built for a safer digital
            tomorrow · SIH 26104
          </span>
        </footer>
      </main>
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function PageHeading({
  eyebrow,
  title,
  text,
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>

        <p>{text}</p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  tone = "",
}) {
  return (
    <div
      className={`metric ${tone}`}
    >
      <div className="metric-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>

        <b>{value}</b>

        <small>
          ↗ {note}
        </small>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}) {
  return (
    <div className="legend-row">
      <i className={color} />

      <span>{label}</span>

      <b>{value}</b>
    </div>
  );
}

function StatRow({
  label,
  value,
}) {
  return (
    <div className="quick-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ResultMetric({
  label,
  value,
}) {
  return (
    <div className="result-metric">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function SignalRow({
  label,
}) {
  return (
    <div className="signal-row">
      <span>{label}</span>
      <b className="on">
        ACTIVE
      </b>
    </div>
  );
}

export default App;