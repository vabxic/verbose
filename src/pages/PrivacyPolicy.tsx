import React from 'react';
import './LegalPages.css';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <p>Effective date: February 20, 2026</p>

        <p>
          Welcome to Verbose. Your privacy is important to us. This Privacy Policy explains how
          Verbose ("we", "us" or "our") collects, uses, discloses, and protects information when
          you use our website and services hosted at https://verbose-eta.vercel.app/ (the
          "Service").
        </p>

        <h2>Information We Collect</h2>
        <ul>
          <li>
            <strong>Account Information:</strong> If you create an account, we collect information
            you provide such as name and email address.
          </li>
          <li>
            <strong>Usage Data:</strong> We collect anonymous analytics about how the Service is
            used to improve performance and features.
          </li>
          <li>
            <strong>Files:</strong> Files you upload to rooms are stored in Supabase Storage by
            default. If you connect a third-party cloud provider (for example Google Drive), files
            you explicitly save to that provider are transferred directly to and stored by that
            provider.
          </li>
        </ul>

        <h2>How We Use Information</h2>
        <p>
          We use collected information to provide and improve the Service, to communicate with you,
          and to comply with legal obligations. We do not sell personal data to third parties.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          We may use third-party services (such as Supabase for authentication and storage) that
          have their own privacy practices. If you connect external cloud storage (Google Drive,
          Dropbox, OneDrive), uploads to those providers are handled directly between your browser
          and the provider; Verbose does not custody those files except for public sharing links
          that your cloud provider may create.
        </p>

        <h2>Security</h2>
        <p>
          We take reasonable technical and organizational measures to protect information. No
          service is completely secure; please avoid uploading sensitive personal data unless you
          are comfortable with the storage destination.
        </p>

        <h2>Children</h2>
        <p>The Service is not intended for children under 13. We do not knowingly collect information from children.</p>

        <h2>Your Choices</h2>
        <p>
          You may delete your account and data by contacting support or using account settings where
          available. You can disconnect third-party cloud providers from the Cloud Storage settings.
        </p>

        <h2>Changes</h2>
        <p>We may update this Privacy Policy. We will post the new policy on this page with an updated effective date.</p>

        <h2>Contact</h2>
        <p>If you have questions, contact us at vaibhavsingh4805@gmail.com.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
