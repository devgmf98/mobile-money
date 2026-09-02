import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/footer.css';
import mpLogo from '../assets/mp-logo.png';
import { useAuthStore } from '../context/store';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const user = useAuthStore((state) => state.user);
  // Shared by user / agent / admin, so routes come from the role rather than
  // being hardcoded. The previous '#dashboard' style anchors went nowhere.
  const baseRoute = `/${user?.role || 'user'}`;

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section footer-brand">
            <div className="footer-logo-plate">
              <img src={mpLogo} alt="MoneyPay" className="footer-logo" />
            </div>
            <p>Fast, secure, and reliable money transfer service.</p>
          </div>

          {/* This footer now appears on the public pages too — Contact, Help
              and the three legal documents — where there may be nobody signed
              in. Pointing a visitor at /user/dashboard only bounces them to
              the login screen, so signed out they get the links that actually
              lead somewhere. */}
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              {user ? (
                <>
                  <li><Link to={`${baseRoute}/dashboard`}>Dashboard</Link></li>
                  <li><Link to={`${baseRoute}/transactions`}>Transactions</Link></li>
                  <li><Link to={`${baseRoute}/profile`}>Profile</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/login">Sign in</Link></li>
                  <li><Link to="/register">Create account</Link></li>
                  <li><Link to="/forgot-password">Reset password</Link></li>
                </>
              )}
            </ul>
          </div>

          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              {user ? <li><Link to={`${baseRoute}/notifications`}>Notifications</Link></li> : null}
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/help">Help Center</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/security">Security</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} MoneyPay. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
