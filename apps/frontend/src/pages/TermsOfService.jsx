import React from 'react';
import LegalPage, { LegalSection } from '../components/LegalPage';

const TermsOfService = () => (
  <LegalPage title="Terms of Service" lastUpdated="June 15, 2026">
    <p>
      Welcome to Truegle Search. By accessing or using <strong>truegle.info</strong> and our
      related services (the "Service"), you agree to these Terms of Service. If you do not
      agree, please do not use the Service.
    </p>

    <LegalSection heading="The Service">
      <p>
        Truegle is a search engine that aggregates results from multiple third-party providers
        and offers different search modes and tools. Search results, summaries, and third-party
        content are provided "as is" and do not represent the views or endorsement of Truegle.
        We do not control and are not responsible for third-party websites or content surfaced
        in results.
      </p>
    </LegalSection>

    <LegalSection heading="Accounts">
      <p>
        You may use Truegle without an account. If you create one, you are responsible for
        keeping your credentials secure and for activity under your account. Provide accurate
        information and notify us of any unauthorized use.
      </p>
    </LegalSection>

    <LegalSection heading="Acceptable Use">
      <p>You agree not to:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Use the Service for any unlawful purpose or in violation of others' rights.</li>
        <li>
          Attempt to disrupt, overload, scrape at scale, reverse-engineer, or circumvent
          security or usage limits of the Service.
        </li>
        <li>
          Misuse any research or OSINT tools provided. These are intended only for lawful,
          authorized purposes (such as security research on systems you own or are permitted to
          test). You are solely responsible for ensuring your use complies with applicable law.
        </li>
      </ul>
    </LegalSection>

    <LegalSection heading="Tokens, Premium & Payments">
      <p>
        Certain features use a token-based or premium model. Paid plans are processed securely
        through Stripe; by purchasing, you authorize the applicable charges. Except where
        required by law, payments are non-refundable. We may change features, limits, or pricing
        with reasonable notice.
      </p>
    </LegalSection>

    <LegalSection heading="Intellectual Property">
      <p>
        The Truegle name, branding, and original software are owned by Truegle. Search results
        and third-party content remain the property of their respective owners. You may not copy
        or exploit Truegle's proprietary materials without permission.
      </p>
    </LegalSection>

    <LegalSection heading="Disclaimer of Warranties">
      <p>
        The Service is provided "as is" and "as available" without warranties of any kind,
        express or implied, including accuracy, completeness, fitness for a particular purpose,
        or uninterrupted availability. Search results may be incomplete, outdated, or inaccurate.
      </p>
    </LegalSection>

    <LegalSection heading="Limitation of Liability">
      <p>
        To the maximum extent permitted by law, Truegle and its operators will not be liable for
        any indirect, incidental, special, consequential, or punitive damages, or any loss of
        data, arising from your use of (or inability to use) the Service.
      </p>
    </LegalSection>

    <LegalSection heading="Changes to These Terms">
      <p>
        We may update these Terms from time to time. Continued use of the Service after changes
        take effect constitutes acceptance of the revised Terms.
      </p>
    </LegalSection>

    <LegalSection heading="Contact">
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:truegleai@proton.me" className="text-blue-400 hover:text-blue-300">
          truegleai@proton.me
        </a>
        .
      </p>
    </LegalSection>
  </LegalPage>
);

export default TermsOfService;
