import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, CheckCircle2, AlertCircle, Keyboard } from 'lucide-react';

/**
 * Audio feedback on successful scan
 */
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

export function QrCameraScannerModal({ isOpen, onClose, onScan, title = 'Passenger QR Scanner' }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [manualInput, setManualInput] = useState('');
  const [scanSuccessText, setScanSuccessText] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setManualInput('');
      setScanSuccessText(null);
      setCameraError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        isScanningRef.current = true;
        startDecodingLoop();
      }
    } catch (err) {
      console.warn('Camera start error:', err);
      setCameraError(err.message || 'Camera permission denied or camera not found.');
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startDecodingLoop = () => {
    const scanFrame = () => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          handleDetectedCode(code.data);
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleDetectedCode = (codeStr) => {
    isScanningRef.current = false;
    playBeep();
    setScanSuccessText('QR Code Scanned Successfully!');

    if (onScan) {
      onScan(codeStr);
    }

    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    playBeep();
    if (onScan) {
      onScan(manualInput.trim());
    }
    onClose();
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(520px, 100%)',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <Camera size={20} color="#06b6d4" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Scanner"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '.25rem'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '280px',
            backgroundColor: '#020617',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Viewfinder Target Overlay */}
          {cameraActive && !scanSuccessText && (
            <div
              style={{
                position: 'absolute',
                width: '210px',
                height: '210px',
                border: '2px solid rgba(6, 182, 212, 0.8)',
                borderRadius: '12px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#06b6d4',
                  boxShadow: '0 0 8px #06b6d4',
                  animation: 'scanLine 2s infinite alternate'
                }}
              />
            </div>
          )}

          {/* Success Overlay */}
          {scanSuccessText && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(16, 185, 129, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                gap: '.5rem',
                zIndex: 10
              }}
            >
              <CheckCircle2 size={48} />
              <strong style={{ fontSize: '1.1rem' }}>{scanSuccessText}</strong>
            </div>
          )}

          {/* Error Message */}
          {cameraError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: '#f87171',
                gap: '.5rem'
              }}
            >
              <AlertCircle size={36} />
              <strong style={{ fontSize: '.95rem' }}>Unable to access camera</strong>
              <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{cameraError}</span>
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-secondary"
                style={{ marginTop: '.5rem', fontSize: '.8rem', padding: '.4rem .8rem' }}
              >
                <RefreshCw size={14} /> Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Camera Controls & Instruction */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>
            Aim camera at commuter QR pass or barcode scanner
          </span>
          <button
            type="button"
            onClick={toggleCameraFacing}
            className="btn btn-secondary"
            style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
          >
            <RefreshCw size={12} /> Flip Camera
          </button>
        </div>

        {/* Hardware Barcode Scanner / Manual Input fallback */}
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or type/paste QR pass code / scan gun..."
              style={{ fontSize: '.85rem', paddingRight: '2rem' }}
              autoFocus
            />
            <Keyboard
              size={15}
              color="#64748b"
              style={{ position: 'absolute', right: '.7rem', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '.5rem 1rem', fontSize: '.85rem' }}>
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
