import { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';
import '../styles/qr-scanner.css';
import { Check, X } from 'lucide-react';

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          setError('');
          scanQRCode();
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access to scan QR codes.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera device found. Please check your device.');
        } else {
          setError('Unable to access camera. Please try again.');
        }
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const scanQRCode = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !isCameraActive) return;

    const ctx = canvas.getContext('2d');
    
    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          try {
            const data = JSON.parse(code.data);
            setScanResult(data);
            
            // Extract phone number from QR code data - keep full number
            let phoneNumber = data.phone || data.recipient || data.phoneNumber;
            
            if (phoneNumber) {
              // Clean up phone number but keep full number
              phoneNumber = phoneNumber.replace(/\s/g, '').trim();
              
              if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
              }
              setIsCameraActive(false);
              onScan({
                phoneNumber: phoneNumber,
                rawData: data
              });
            }
          } catch (e) {
            // QR code might not be JSON, try to use it as a phone number directly
            try {
              const phoneNumber = code.data.replace(/\s/g, '').trim();
              if (phoneNumber.length >= 9) {
                if (videoRef.current?.srcObject) {
                  videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                }
                setIsCameraActive(false);
                onScan({
                  phoneNumber: phoneNumber,
                  rawData: { data: code.data }
                });
              }
            } catch (err) {
              console.error('Error parsing QR code:', err);
            }
          }
        }
      }
      
      if (isCameraActive) {
        requestAnimationFrame(scan);
      }
    };

    scan();
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current?.srcObject) {
      scanQRCode();
    }
  }, [isCameraActive]);

  const handleClose = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
    onClose();
  };

  const handleRetry = () => {
    setScanResult(null);
    if (!videoRef.current?.srcObject) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsCameraActive(true);
            setError('');
          }
        } catch (err) {
          setError('Unable to access camera. Please try again.');
        }
      };
      startCamera();
    } else {
      setIsCameraActive(true);
    }
  };

  return (
    <div className="qr-scanner-modal">
      <div className="qr-scanner-overlay" onClick={handleClose}></div>
      <div className="qr-scanner-container">
        <div className="qr-scanner-header">
          <h2>Scan QR Code</h2>
          <button className="qr-scanner-close" onClick={handleClose}><X size={18} /></button>
        </div>

        <div className="qr-scanner-body">
          {error && (
            <div className="alert alert-danger">
              <p>{error}</p>
              <button className="btn btn-secondary btn-sm" onClick={handleClose}>
                Close Scanner
              </button>
            </div>
          )}

          {!error && (
            <>
              <div className="qr-video-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="qr-video"
                />
                <div className="qr-scan-frame"></div>
              </div>

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {scanResult && (
                <div className="qr-scan-result">
                  <div className="alert alert-success">
                    <p><Check size={18} /> QR Code detected!</p>
                    <p className="text-small">Processing payment...</p>
                  </div>
                </div>
              )}

              <div className="qr-scanner-info">
                <p>Point your camera at the QR code</p>
                <p className="text-small text-muted">The system will automatically detect and process the QR code</p>
              </div>

              {scanResult && (
                <div className="qr-scanner-actions">
                  <button className="btn btn-secondary" onClick={handleRetry}>
                    Scan Again
                  </button>
                  <button className="btn btn-primary" onClick={handleClose}>
                    Continue with Result
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
