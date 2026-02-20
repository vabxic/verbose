import React from 'react';
import './LegalPages.css';

const TermsAndServices: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Terms of Service</h1>
        <p>Effective date: February 20, 2026</p>

        <h2>1. Acceptance</h2>
        <p>
          By using Verbose ("Service"), you agree to these Terms of Service. If you do not agree,
          do not use the Service.
        </p>

        <h2>2. Use of the Service</h2>
        <p>
          The Service provides real-time chat, file sharing, and optional integration with third-party
          cloud storage providers. You are responsible for your use of the Service and for complying
          with applicable laws.
        </p>

        <h2>3. User Content</h2>
        <p>
          You retain ownership of files and messages you create. By using the Service you grant
          Verbose a limited license to store, transmit, and display your content as necessary to
          provide the Service.
        </p>

        <h2>4. Prohibited Conduct</h2>
        <p>
          You must not use the Service to transmit illegal content, infringe intellectual property,
          harass others, or distribute malware. We reserve the right to suspend or terminate accounts
          that violate these Terms.
        </p>

        <h2>5. Third-Party Services</h2>
        <p>
          Integrations with third-party services (e.g., Google Drive) are subject to the third
          party's terms and privacy policies. Verbose is not responsible for the actions of third
          parties.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Verbose is provided "as is" and we are not
          liable for indirect, incidental, or consequential damages arising from your use of the
          Service.
        </p>

        <h2>7. Governing Law</h2>
        <p>These Terms are governed by the laws of the jurisdiction where Verbose is operated.</p>

        <h2>8. Changes</h2>
        <p>We may modify these Terms. Continued use of the Service after changes constitutes acceptance.</p>

        <h2>Contact</h2>
        <p>Questions about these Terms should be sent to vaibhavsingh4805@gmail.com</p>
      </div>
    </div>
  );
};

export default TermsAndServices;
