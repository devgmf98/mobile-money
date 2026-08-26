import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/store';
import QRCode from 'qrcode.react';
import { ArrowLeft, Copy, Download } from 'lucide-react';
import Footer from '../components/Footer';
import '../styles/receive-qr.css';
import mpLogo from '../assets/mp-logo.png';

/* The downloaded card is drawn with canvas primitives rather than rasterising
   the DOM: the QR already renders to a <canvas>, so its pixels can be copied
   straight across, and the output stays crisp and identical everywhere. */
const SCALE = 2;                 // drawn at 2x for retina, exported at 2x
const CARD_W = 380;
const CARD_H = 520;

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not load the logo'));
  img.src = src;
});

export default function ReceiveQR() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [copied, setCopied] = useState(false);

  if (!user) {
    return <div>Loading...</div>;
  }

  // Format phone number with +211 prefix
  const phoneNumber = (() => {
    const phone = user?.phone || user?.phoneNumber || '';
    if (!phone.startsWith('+')) {
      return '+211' + (phone.startsWith('211') ? phone.substring(3) : phone);
    }
    return phone;
  })();

  const qrData = JSON.stringify({
    phone: phoneNumber,
    recipient: phoneNumber,
    phoneNumber: phoneNumber,
    name: user?.name || 'User',
    type: 'payment'
  });

  const qrRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const qrCanvas = qrRef.current?.querySelector('canvas');
    if (!qrCanvas) return;

    setDownloading(true);
    try {
      const logo = await loadImage(mpLogo).catch(() => null);

      const canvas = document.createElement('canvas');
      canvas.width = CARD_W * SCALE;
      canvas.height = CARD_H * SCALE;
      const ctx = canvas.getContext('2d');
      ctx.scale(SCALE, SCALE);
      ctx.textBaseline = 'top';

      // card
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // green band behind the logo
      const band = ctx.createLinearGradient(0, 0, CARD_W, 108);
      band.addColorStop(0, '#065F46');
      band.addColorStop(1, '#087443');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, CARD_W, 108);

      // logo on a white chip, so its colours stay readable on the green
      if (logo) {
        const lw = 168;
        const lh = (logo.height / logo.width) * lw;
        const cx = (CARD_W - lw) / 2;
        const cy = (108 - lh) / 2;
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, cx - 14, cy - 10, lw + 28, lh + 20, 12);
        ctx.fill();
        ctx.drawImage(logo, cx, cy, lw, lh);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 26px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MoneyPay', CARD_W / 2, 40);
      }

      // QR on a framed white tile
      const qrSize = 220;
      const qrX = (CARD_W - qrSize) / 2;
      const qrY = 140;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      roundRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 16);
      ctx.fill();
      ctx.stroke();
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // name and phone
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 21px Inter, Arial, sans-serif';
      ctx.fillText(user?.name || 'MoneyPay user', CARD_W / 2, qrY + qrSize + 34);

      ctx.fillStyle = '#087443';
      ctx.font = '600 17px Inter, Arial, sans-serif';
      ctx.fillText(phoneNumber, CARD_W / 2, qrY + qrSize + 62);

      // footer rule and caption
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(40, CARD_H - 66);
      ctx.lineTo(CARD_W - 40, CARD_H - 66);
      ctx.stroke();

      // Two lines: on one line the caption overflows the card for any normal
      // name. The payee line also shrinks if the name is unusually long.
      ctx.fillStyle = '#64748B';
      ctx.font = '400 12.5px Inter, Arial, sans-serif';
      ctx.fillText('Scan this code with MoneyPay', CARD_W / 2, CARD_H - 52);

      // same weight and colour as the line above; it still shrinks if a long
      // name would overflow the card
      const payee = user?.name || phoneNumber;
      const payLine = `to pay ${payee}`;
      const maxLine = CARD_W - 72;
      let size = 12.5;
      ctx.font = `400 ${size}px Inter, Arial, sans-serif`;
      while (ctx.measureText(payLine).width > maxLine && size > 9) {
        size -= 0.5;
        ctx.font = `400 ${size}px Inter, Arial, sans-serif`;
      }
      ctx.fillText(payLine, CARD_W / 2, CARD_H - 34);

      const safeName = String(user?.name || 'moneypay').replace(/[^\w-]/g, '_');
      const link = document.createElement('a');
      link.download = `moneypay-qr-${safeName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to build the QR image:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyCopyPhone = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="page-container receive-qr">
        <div className="page-header">
          <h1>Receive Money</h1>
          <p>Share your QR code to receive payments</p>
        </div>

        <div className="receive-qr-card">
          <div className="qr-section">
            <div className="qr-container" ref={qrRef}>
              <QRCode
                value={qrData}
                size={256}
                level="H"
                includeMargin={true}
                renderAs="canvas"
              />
            </div>

            <div className="user-info">
              <h3>{user?.name}</h3>
              <div className="phone-display">
                <span className="phone-label">Phone:</span>
                <span className="phone-number">{phoneNumber}</span>
                <button
                  className="copy-btn"
                  onClick={handleCopyCopyPhone}
                  title="Copy phone number"
                >
                  <Copy />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="instructions">
              <h4>How to receive money:</h4>
              <ol>
                <li>Share your QR code with the sender</li>
                <li>They scan the code using their MoneyPay app</li>
                <li>Money will be transferred to your account</li>
              </ol>
            </div>

            <div className="action-buttons">
              <button
                className="btn btn-primary qr-download"
                onClick={handleDownload}
                disabled={downloading}
              >
                <Download size={17} /> {downloading ? 'Preparing…' : 'Download QR code'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft /> Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
