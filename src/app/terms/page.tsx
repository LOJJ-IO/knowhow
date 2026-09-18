import type { Metadata } from "next";
import Link from "next/link";
import {
  Callout,
  Clause,
  LegalPage,
  LINK_CLASS,
  List,
  Section,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use — Knohow",
  description: "The terms that apply to your use of Knohow.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      href="/terms"
      effective="17 September 2026"
      plural
    >
      <Section n={1} title="Overview">
        <Clause>
          Welcome to Knohow. These Terms of Use (&ldquo;Terms&rdquo;) apply to
          your (&ldquo;you&rdquo; or &ldquo;your&rdquo;) use of Knohow, a
          service that helps organizations using Google Workspace see, organize
          and keep their company documents (the &ldquo;Service&rdquo;). The
          Service is provided by LOJJ.IO (&ldquo;Knohow&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;). By using
          the Service, you agree that these Terms form a legally binding
          agreement between you and LOJJ.IO.
        </Clause>
        <Clause>
          Our{" "}
          <Link href="/privacy" className={LINK_CLASS}>
            Privacy Policy
          </Link>{" "}
          explains how we collect and use personal information and forms part
          of these Terms. If your organization has signed an order form or
          other written agreement with us, that agreement governs where it
          conflicts with these Terms.
        </Clause>
        <Callout>
          <p className="m-0">
            By using Knohow you agree to these Terms and our Privacy Policy. If
            you don&rsquo;t agree, please don&rsquo;t use the Service.
          </p>
        </Callout>
      </Section>

      <Section n={2} title="Eligibility and your account">
        <Clause label="A. Who can use Knohow.">
          You must be at least 18 years old to use the Service. The Service is
          intended for business and organizational use.
        </Clause>
        <Clause label="B. Signing in with Google.">
          You sign in to Knohow with a Google account. You are responsible for
          keeping that account secure and for all activity that happens through
          your Knohow account. Tell us promptly at{" "}
          <a href="mailto:info@lojj.io" className={LINK_CLASS}>
            info@lojj.io
          </a>{" "}
          if you believe your account has been accessed without your
          permission.
        </Clause>
        <Clause label="C. Using Knohow for an organization.">
          If you use the Service on behalf of a company or other organization
          (an &ldquo;Organization&rdquo;), you confirm that you have authority
          to bind that Organization to these Terms, and &ldquo;you&rdquo;
          includes the Organization.
        </Clause>
      </Section>

      <Section n={3} title="Organizations, roles and authority">
        <Clause label="A. Separate roles.">
          Knohow keeps four things separate: your identity, your membership in
          an Organization, ownership of the Organization, and Google Workspace
          administrator authority. Each is established by its own proof, and
          none is assumed from another. For example, setting up an Organization
          does not make you its owner, and being its owner does not make you a
          Google Workspace administrator.
        </Clause>
        <Clause label="B. Owners and administrators.">
          An Organization&rsquo;s owner is confirmed by signing in with the
          invited Google account. Workspace-wide features are only enabled after
          a Google Workspace Super Administrator authorizes Knohow through
          Google. We rely on Google to verify administrator status; we never
          grant it.
        </Clause>
        <Clause label="C. Members.">
          People may be associated with an Organization based on their Google
          Workspace account, or approved into it by someone with authority to do
          so. What a member can see and do depends on the role the Organization
          gives them.
        </Clause>
        <Callout>
          <p className="m-0">
            Your organization controls who belongs to it and what each person
            can do. Knohow never grants Google Workspace admin rights.
          </p>
        </Callout>
      </Section>

      <Section n={4} title="Google Workspace access">
        <Clause label="A. What you authorize.">
          To provide the Service, Knohow connects to Google Workspace using the
          permissions you or your Organization&rsquo;s administrator grant. This
          can include reading information about files in Google Drive and, where
          your Organization has authorized it, changing file sharing and
          ownership on the Organization&rsquo;s behalf.
        </Clause>
        <Clause label="B. Google's rules still apply.">
          Your use of Google Workspace remains subject to Google&rsquo;s own
          terms and to your Organization&rsquo;s Workspace settings. Google
          decides what actions are possible. For example, Google does not allow
          ownership of a file to move between a personal Google account and a
          Workspace account. Knohow cannot change who owns a file in Google
          except through the actions Google allows.
        </Clause>
        <Clause label="C. Revoking access.">
          You can revoke Knohow&rsquo;s access to your Google account at any
          time from your Google Account settings, and Workspace administrators
          can revoke domain-wide access from the Google Admin console. Some
          features will stop working once access is revoked.
        </Clause>
      </Section>

      <Section n={5} title="Your content and files">
        <Clause label="A. You own your content.">
          You and your Organization keep all rights in your files and content.
          You give us permission to access and process them only as needed to
          provide, secure and support the Service for you.
        </Clause>
        <Clause label="B. Company, personal and external files.">
          Knohow helps identify which files belong to the Organization. It
          distinguishes company files, your own personal files and files owned
          by people outside the Organization. A file only becomes a company file
          in Knohow when someone proposes it and an authorized person in the
          Organization confirms it, unless it already sits in the
          Organization&rsquo;s shared drive. Files you mark as personal are not
          shown to your Organization.
        </Clause>
        <Clause label="C. Suggestions, not decisions.">
          Where Knohow suggests how a file should be classified, the suggestion
          is based on the information available and may be wrong. A suggestion
          is never, on its own, authority to move, share or take ownership of a
          file. You and your Organization are responsible for the decisions you
          confirm.
        </Clause>
        <Callout>
          <p className="m-0">
            Knohow suggests; people decide. Your personal files stay yours and
            aren&rsquo;t shown to your organization.
          </p>
        </Callout>
      </Section>

      <Section n={6} title="Acceptable use">
        <Clause>You agree not to:</Clause>
        <List>
          <li>use the Service to break any law or anyone else&rsquo;s rights;</li>
          <li>
            access, or try to access, another person&rsquo;s files, account or
            Organization without authorization;
          </li>
          <li>
            claim ownership of, or authority over, an Organization, domain or
            account you do not control;
          </li>
          <li>
            interfere with, disrupt, probe or attempt to bypass the security of
            the Service;
          </li>
          <li>
            copy, resell or reverse engineer the Service, except where the law
            allows it; or
          </li>
          <li>upload malicious code or use the Service to send spam.</li>
        </List>
      </Section>

      <Section n={7} title="Automated and AI features">
        <Clause>
          Knohow classifies files using rules on file information first, then
          lightweight models, and only uses more advanced analysis or AI when
          simpler methods can&rsquo;t decide. Automated results are
          recommendations and may be inaccurate. We do not use your content to
          train models without your consent. See our{" "}
          <Link href="/privacy" className={LINK_CLASS}>
            Privacy Policy
          </Link>{" "}
          for details.
        </Clause>
      </Section>

      <Section n={8} title="Plans, pricing and payment">
        <Clause>
          Access to the Service is arranged with our sales team. Fees, billing
          periods and payment terms are set out in the order form or agreement
          your Organization accepts. Unless that agreement says otherwise, fees
          are non-refundable and exclude applicable taxes. To discuss a plan,
          contact us at{" "}
          <a href="mailto:info@lojj.io" className={LINK_CLASS}>
            info@lojj.io
          </a>
          .
        </Clause>
      </Section>

      <Section n={9} title="Knohow's intellectual property">
        <Clause>
          The Service, including its software, design, logos and the Knohow
          name, belongs to LOJJ.IO and its licensors. These Terms give you a
          limited, non-exclusive, non-transferable right to use the Service
          while you comply with them. If you send us feedback, we may use it
          without any obligation to you.
        </Clause>
      </Section>

      <Section n={10} title="Third-party services">
        <Clause>
          The Service depends on third-party services, including Google
          Workspace and our hosting and infrastructure providers. Those services
          are governed by their own terms, and we are not responsible for their
          availability or actions.
        </Clause>
      </Section>

      <Section n={11} title="Disclaimers">
        <Clause>
          To the extent permitted by law, the Service is provided &ldquo;as
          is&rdquo; and &ldquo;as available&rdquo;, without warranties of any
          kind, including warranties of merchantability, fitness for a
          particular purpose and non-infringement. We do not guarantee that the
          Service will be uninterrupted or error-free, or that file
          classifications or other automated results will be accurate.
        </Clause>
      </Section>

      <Section n={12} title="Limitation of liability">
        <Clause>
          To the extent permitted by law, LOJJ.IO will not be liable for any
          indirect, incidental, special, consequential or punitive damages, or
          for lost profits, revenue or data, arising from your use of the
          Service. Our total liability for any claim relating to the Service is
          limited to the greater of the fees you paid us for the Service in the
          12 months before the claim arose, or CAD $100. These limits do not
          apply to liability that cannot be limited by law, including liability
          for gross negligence or wilful misconduct.
        </Clause>
      </Section>

      <Section n={13} title="Indemnity">
        <Clause>
          You agree to indemnify LOJJ.IO against claims, losses and costs
          (including reasonable legal fees) arising from your breach of these
          Terms or your misuse of the Service.
        </Clause>
      </Section>

      <Section n={14} title="Suspension and termination">
        <Clause>
          You may stop using the Service at any time. We may suspend or end your
          access if you breach these Terms, if required by law, or if your
          Organization&rsquo;s agreement with us ends. Where reasonable, we will
          give you notice first. Sections that by their nature should survive
          termination, including 9 and 11 to 16, will survive.
        </Clause>
      </Section>

      <Section n={15} title="Changes to these Terms">
        <Clause>
          We may update these Terms from time to time. We will post the new
          version with an updated effective date, and for material changes we
          will give you reasonable advance notice, for example by email or in
          the Service. If you continue to use the Service after changes take
          effect, you accept the updated Terms.
        </Clause>
      </Section>

      <Section n={16} title="Governing law and disputes">
        <Clause>
          These Terms are governed by the laws of the Province of Alberta and
          the federal laws of Canada that apply there. Before starting any
          formal proceeding, you agree to contact us at{" "}
          <a href="mailto:info@lojj.io" className={LINK_CLASS}>
            info@lojj.io
          </a>{" "}
          and try in good faith to resolve the dispute informally for at least
          30 days. If it isn&rsquo;t resolved, the courts of Alberta, sitting in
          Edmonton, will have exclusive jurisdiction.
        </Clause>
      </Section>

      <Section n={17} title="General">
        <Clause>
          These Terms, together with our Privacy Policy and any order form or
          agreement with your Organization, are the entire agreement between you
          and us about the Service. If any part of these Terms is found
          unenforceable, the rest remains in effect. Our failure to enforce a
          provision is not a waiver. You may not assign these Terms without our
          consent; we may assign them in connection with a merger, acquisition
          or sale of assets.
        </Clause>
      </Section>

      <Section n={18} title="Contact us">
        <Clause>
          LOJJ.IO, Edmonton, Alberta, Canada. Email{" "}
          <a href="mailto:info@lojj.io" className={LINK_CLASS}>
            info@lojj.io
          </a>
          .
        </Clause>
      </Section>
    </LegalPage>
  );
}
