import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import { useAuthStore } from '../context/store';
import { authAPI } from '../utils/api';
import '../styles/profile.css';
import '../styles/profile-flow.css';
import { Camera, Check, Folder, Hourglass, Moon, Settings, Sun, Upload, User, X } from 'lucide-react';

/* Avatar encoding. At module scope so both the file-upload and selfie paths
   read the same values regardless of declaration order inside the component. */
const AVATAR_PX = 512;
const AVATAR_QUALITY = 0.85;

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const setTheme = useAuthStore((state) => state.setTheme);
  const updateUser = useAuthStore((state) => state.updateUser);
  const storeTheme = useAuthStore((state) => state.theme);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    idNumber: '',
    profileImage: '',
    autoAdminCashout: false,
    theme: 'light'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraRunning, setCameraRunning] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        idNumber: user.idNumber || '',
        profileImage: user.profileImage || '',
        autoAdminCashout: !!user.autoAdminCashout,
        theme: user.theme || 'light'
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggle = (e) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
    try {
      // Update global auth store immediately so dashboard badge updates in real-time
      const store = useAuthStore.getState();
      if (store && store.user) {
        const updatedUser = { ...store.user, [name]: checked };
        store.updateUser(updatedUser);
      }
    } catch (err) {
      console.error('Failed to update auth store on toggle', err);
    }
  };

  const handleAutoAdminCashoutChange = async (e) => {
    const checked = e.target.checked;
    // optimistic update UI
    setFormData((prev) => ({ ...prev, autoAdminCashout: checked }));

    try {
      const { data } = await authAPI.updateProfile({ autoAdminCashout: checked });
      if (data) {
        updateUser(data);
      }

      const status = checked ? 'ON' : 'OFF';
      setToastMessage(`Admin Cash-Out approval: ${status}`);
      setToastType('success');
    } catch (err) {
      // revert UI on failure
      setFormData((prev) => ({ ...prev, autoAdminCashout: !checked }));
      setToastMessage(err.response?.data?.message || 'Failed to update setting');
      setToastType('error');
      console.error('Failed to update autoAdminCashout:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data } = await authAPI.updateProfile(formData);
      setMessage('Profile updated successfully!');
      
      // Show specific toast for Admin Cash-Out approval changes
      if (user?.role === 'agent' && typeof formData.autoAdminCashout !== 'undefined') {
        const status = formData.autoAdminCashout ? 'ON' : 'OFF';
        setToastMessage(`Admin Cash-Out approval: ${status}`);
        setToastType('success');
      }

      // Show toast for theme changes
      if (typeof formData.theme !== 'undefined' && formData.theme !== user?.theme) {
        const themeLabel = formData.theme === 'dark' ? 'Dark Mode' : 'Light Mode';
        setToastMessage(`Theme changed to ${themeLabel}`);
        setToastType('success');
      }
      
      // API returns updated user object - sync both store and form state
      if (data) {
        updateUser(data);
        if (data.theme) {
          setTheme(data.theme);
        }
        // Update form data with server response to ensure consistency
        setFormData({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          idNumber: data.idNumber || '',
          profileImage: data.profileImage || '',
          autoAdminCashout: !!data.autoAdminCashout,
          theme: data.theme || 'light'
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeToggle = async (newTheme) => {
    try {
      const { data } = await authAPI.updateProfile({ theme: newTheme });
      if (data) {
        updateUser(data);
        if (data.theme) setTheme(data.theme);
        setFormData((prev) => ({ ...prev, theme: data.theme || newTheme }));
      }

      const themeLabel = newTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
      setToastMessage(`Theme changed to ${themeLabel}`);
      setToastType('success');
    } catch (err) {
      console.error('Failed to change theme:', err);
      setToastMessage('Failed to change theme');
      setToastType('error');
    }
  };

  // Leaving the page with the modal open previously left the camera running —
  // nothing stopped the tracks on unmount.
  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    try {
      setShowCameraModal(true);
      setCameraRunning(false); // Reset first
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      // Track the stream before anything else can fail. Previously this lived
      // inside the `if (videoRef.current)` branch, so when that branch was
      // skipped the camera stayed on with no way to stop it.
      streamRef.current = stream;

      // The modal renders in the commit triggered above, so by the time this
      // await resolves the element exists; the rAF is a belt-and-braces retry.
      const attach = () => {
        const el = videoRef.current;
        if (!el) {
          requestAnimationFrame(attach);
          return;
        }
        el.srcObject = stream;
        el.onloadedmetadata = () => {
          el.play()
            .then(() => setCameraRunning(true))
            .catch((err) => {
              console.error('Failed to play video:', err);
              setToastMessage('Could not start the camera preview.');
              setToastType('error');
            });
        };
      };
      attach();
    } catch (err) {
      console.error('Failed to access camera:', err);
      setToastMessage('Unable to access camera. Please check permissions.');
      setToastType('error');
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.srcObject = null;
    }
    setCameraRunning(false);
    setShowCameraModal(false);
  };

  const takeSelfie = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const context = canvasRef.current.getContext('2d');
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      // Same treatment as an uploaded file: center-crop to a square at 512px.
      // This was 100x100 at quality 0.1, and scaled to fit rather than
      // cropping, so a 4:3 camera produced a 100x75 image in a round frame.
      const side = Math.min(videoWidth, videoHeight);
      const sx = (videoWidth - side) / 2;
      const sy = (videoHeight - side) / 2;
      const target = Math.min(AVATAR_PX, side);

      canvasRef.current.width = target;
      canvasRef.current.height = target;
      context.imageSmoothingQuality = 'high';
      context.drawImage(videoRef.current, sx, sy, side, side, 0, 0, target, target);

      const blob = await new Promise((resolve, reject) => {
        canvasRef.current?.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to capture the photo'))),
          'image/jpeg',
          AVATAR_QUALITY
        );
      });

      await uploadProfileImage(blob, 'selfie.jpg');
      stopCamera();
    } catch (err) {
      console.error('Failed to take selfie:', err);
      setToastMessage('Failed to capture selfie');
      setToastType('error');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setToastMessage('Please select a valid image file');
        setToastType('error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setToastMessage('Image must be less than 10MB');
        setToastType('error');
        return;
      }
      // Compress the image before uploading
      compressAndUpload(file);
    }
  };

  /* Compress once, to a square avatar.

     This previously scaled to 100x100 at quality 0.1, then re-compressed to
     80x80 at 0.05 if the result still exceeded 50KB — which produced a blurry
     thumbnail. That was a workaround for a small database column; the column
     is now LONGTEXT and the server accepts 100MB bodies, so neither limit
     applies. 512px at 0.85 gives a crisp avatar in roughly 30-120KB.

     It also center-crops to a square: the old code scaled to fit, so a
     landscape photo became a short wide image that the round frame squashed. */
  const compressAndUpload = async (file) => {
    setUploadingImage(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read that file'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('That file is not a readable image'));
        image.src = dataUrl;
      });

      // center-crop the largest square the source allows
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const target = Math.min(AVATAR_PX, side);

      const canvas = document.createElement('canvas');
      canvas.width = target;
      canvas.height = target;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))),
          'image/jpeg',
          AVATAR_QUALITY);
      });

      await uploadProfileImage(blob, file.name || 'profile.jpg');
    } catch (err) {
      console.error('Failed to process image:', err);
      setToastMessage(err.message || 'Failed to process image');
      setToastType('error');
      setUploadingImage(false);
    }
  };

  const uploadProfileImage = async (blob, fileName) => {
    setUploadingImage(true);

    try {
      // Convert blob to base64 string
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result);
          } else {
            reject(new Error('Failed to read file as string'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(blob);
      });

      // Sanity ceiling only. The column is LONGTEXT and the server accepts
      // 100MB bodies, so this exists to catch a pathological encode, not to
      // force the image smaller — the old 100KB gate rejected any usable photo.
      if (base64String.length > 4 * 1024 * 1024) {
        setUploadingImage(false);
        setToastMessage('That image is too large even after compression. Try another photo.');
        setToastType('error');
        return;
      }

      const { data } = await authAPI.updateProfile({ profileImage: base64String });
      
      if (data) {
        updateUser(data);
        setFormData((prev) => ({ ...prev, profileImage: data.profileImage }));
      }

      setToastMessage('Profile picture updated successfully!');
      setToastType('success');
    } catch (err) {
      console.error('Failed to upload profile image:', err);
      
      let errorMsg = 'Failed to upload profile picture';
      if (err.response?.status === 413) {
        errorMsg = '413 Payload Too Large: Server limit exceeded';
      } else if (err.response?.status === 400 || err.response?.data?.message?.includes('data too long')) {
        errorMsg = err.response?.data?.message || 'The server rejected that image.';
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setToastMessage(errorMsg);
      setToastType('error');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <>
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
        <p className="text-muted">Manage your account information</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="camera-modal-overlay">
          <div className="camera-modal">
            <div className="camera-modal-header">
              <h3><Camera size={18} /> Take Selfie</h3>
              <button 
                type="button" 
                className="camera-modal-close"
                onClick={stopCamera}
              >
                <X size={18} />
              </button>
            </div>
            <div className="camera-modal-body">
              {/* The video must be mounted BEFORE the stream arrives: srcObject
                  is assigned to this ref, and the ref only exists once it is
                  rendered. Gating it on cameraRunning — which is itself only
                  set from the element's onloadedmetadata — deadlocked, leaving
                  a permanently black modal. */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
              />
              {!cameraRunning && (
                <div className="camera-starting">Starting camera…</div>
              )}
            </div>
            <div className="camera-modal-actions">
              <button 
                type="button"
                className="btn btn-primary"
                onClick={takeSelfie}
                disabled={!cameraRunning || uploadingImage}
              >
                {uploadingImage ? <Hourglass size={18} /> : <Camera size={18} />} {uploadingImage ? 'Uploading...' : 'Capture & Upload'}
              </button>
              <button 
                type="button"
                className="btn btn-outline"
                onClick={stopCamera}
                disabled={uploadingImage}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="profile-grid grid-2">
        {/* Profile Picture Section */}
        <div className="card">
          <div className="card-header">
            <h3><Camera size={18} /> Profile Picture</h3>
          </div>
          <div className="card-body profile-picture-section">
            <div className="profile-picture-container">
              <div className="profile-picture-display">
                {formData.profileImage ? (
                  <img 
                    src={formData.profileImage} 
                    alt="Profile" 
                    className="profile-picture-img"
                  />
                ) : (
                  <div className="profile-picture-placeholder">
                    <span className="placeholder-icon"><User size={28} /></span>
                    <p>No photo yet</p>
                  </div>
                )}
              </div>
              <div className="profile-picture-actions">
                <button 
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? <><Upload size={18} /> Uploading...</> : <><Folder size={18} /> Choose from Files</>}
                </button>
                <button 
                  type="button"
                  className="btn btn-primary"
                  onClick={startCamera}
                  disabled={uploadingImage}
                >
                  <Camera size={18} /> Take Selfie
                </button>
                <input 
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Account Information</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="profile-name">Full Name</label>
                <input
                  id="profile-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled
                  className="input-disabled"
                />
                <small className="text-muted">Name cannot be changed</small>
              </div>

              <div className="form-group">
                <label htmlFor="profile-email">Email Address</label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled
                  className="input-disabled"
                />
                <small className="text-muted">Email cannot be changed</small>
              </div>

              <div className="form-group">
                <label htmlFor="profile-phone">Phone Number</label>
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled
                  className="input-disabled"
                />
                <small className="text-muted">Phone cannot be changed</small>
              </div>

              <div className="form-group">
                <label htmlFor="profile-id">ID Number</label>
                <input
                  id="profile-id"
                  name="idNumber"
                  type="text"
                  autoComplete="off"
                  value={formData.idNumber}
                  onChange={handleInputChange}
                  placeholder="Enter your ID number"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        <div className="card span-2">
          <div className="card-header">
            <h3>Account Details</h3>
          </div>
          <div className="card-body profile-details">
            <div className="detail-item">
              <span className="detail-label">Account Type</span>
              <span className="detail-value badge badge-primary">{user?.role?.toUpperCase() || 'N/A'}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Verification Status</span>
              <span className="detail-value">
                {user?.isVerified ? (
                  <span className="badge badge-success"><Check size={18} /> Verified</span>
                ) : (
                  <span className="badge badge-warning">Pending</span>
                )}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Account Status</span>
              <span className="detail-value">
                {user?.isSuspended ? (
                  <span className="badge badge-danger">Suspended</span>
                ) : (
                  <span className="badge badge-success">Active</span>
                )}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Current Balance</span>
              <span className="detail-value text-success font-weight-bold">SSP {(parseFloat(user?.balance) || 0).toFixed(2)}</span>
            </div>

            {user?.role === 'agent' && user?.agentId && (
              <div className="detail-item">
                <span className="detail-label">Agent ID</span>
                <span className="detail-value" style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14.5px' }}>
                  {user.agentId}
                </span>
              </div>
            )}

            <div className="detail-item">
              <span className="detail-label">Member Since</span>
              <span className="detail-value">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h3><Settings size={18} /> Account Settings</h3>
        </div>
        <div className="card-body">
          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-info">
                <h4>Change Password</h4>
                <p className="text-muted">Update your password regularly for security</p>
              </div>
              <a href="#" className="btn btn-outline">Change Password</a>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h4>Security Settings</h4>
                <p className="text-muted">Manage your login activity and sessions</p>
              </div>
              <a href="#" className="btn btn-outline">View Sessions</a>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h4>Privacy & Notifications</h4>
                <p className="text-muted">Control how you receive notifications</p>
              </div>
              <a href="#" className="btn btn-outline">Manage Preferences</a>
            </div>

            {user?.role === 'agent' && (
              <div className="setting-item">
                <div className="setting-info">
                  <h4>Admin Cash-Out Approval</h4>
                  <p className="text-muted">When enabled, admins can cash out from your account without needing your approval.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="switch">
                    <input type="checkbox" name="autoAdminCashout" checked={formData.autoAdminCashout} onChange={handleAutoAdminCashoutChange} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            )}

            <div className="setting-item">
              <div className="setting-info">
                <h4>Display Mode</h4>
                <p className="text-muted">Choose between light and dark mode for your dashboard</p>
              </div>
              <div className="theme-toggle-row">
                {/* the inline gap:12px plus a marginRight:10px on the label put
                    22px between the track and its text */}
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={storeTheme === 'dark'}
                    onChange={async (e) => {
                      const newTheme = e.target.checked ? 'dark' : 'light';
                      setTheme(newTheme); // optimistic; reconciled on response
                      setFormData((prev) => ({ ...prev, theme: newTheme }));
                      await handleThemeToggle(newTheme);
                    }}
                  />
                  <span className="slider"></span>
                </label>
                <span className="theme-toggle-label">
                  {storeTheme === 'dark'
                    ? <><Moon size={15} /> Dark Mode</>
                    : <><Sun size={15} /> Light Mode</>}
                </span>
              </div>
            </div>
            {/* Mobile Logout Button */}
            {typeof window !== 'undefined' && window.innerWidth <= 768 && (
              <div className="setting-item">
                <button
                  className="btn btn-outline btn-danger"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={() => { logout(); navigate('/login'); }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <Footer />
    <Toast 
      message={toastMessage} 
      type={toastType} 
      onClose={() => setToastMessage('')} 
    />
    </>
  );
}
