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

  // These pages do not exist yet. Rendered as plain text rather than links so
  // the footer keeps its shape without sending anyone to an unrelated screen.
  const pending = (label) => (
    <li key={label}>
      <span className="footer-pending" title="Coming soon">{label}</span>
    </li>
  );

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

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to={`${baseRoute}/dashboard`}>Dashboard</Link></li>
              <li><Link to={`${baseRoute}/transactions`}>Transactions</Link></li>
              <li><Link to={`${baseRoute}/profile`}>Profile</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><Link to={`${baseRoute}/notifications`}>Notifications</Link></li>
              <li><a href="mailto:support@moneypay.app">Contact Us</a></li>
              {pending('Help Center')}
            </ul>
          </div>

          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              {pending('Privacy Policy')}
              {pending('Terms of Service')}
              {pending('Security')}
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
