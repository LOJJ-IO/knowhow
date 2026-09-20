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
  title: "Privacy Policy | Knohow",
  description: "How Knohow collects, uses and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      href="/privacy"
      effective="17 September 2026"
    >
      <Section n={1} title="Overview">
        <Clause>
          This Privacy Policy explains how LOJJ.IO (&ldquo;Knohow&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) collects,
          uses, shares and protects personal information when you use Knohow
          (the &ldquo;Service&rdquo;). It should be read with our{" "}
          <Link href="/terms" className={LINK_CLASS}>
            Terms of Use
          </Link>
          .
        </Clause>
        <Clause>
          When you use Knohow as part of an organization, that organization
          decides how the Service is used for its company information. We
          process that information on the organization&rsquo;s behalf and
          according to its instructions and this policy.
        </Clause>
        <Callout>
          <p className="m-0">
            We collect as little as we need, we don&rsquo;t sell your
            information, and your personal files are never shown to your
            organization.
          </p>
        </Callout>
      </Section>

      <Section n={2} title="Information we collect">
        <Clause label="A. Account information.">
          When you sign in with Google, we receive your name, email address,
          profile picture, Google account identifier and, for Google Workspace
          accounts, your Workspace domain.
        </Clause>
        <Clause label="B. Organization information.">
          Your organization&rsquo;s name and domain, its teams and org chart,
          and each member&rsquo;s role and membership.
        </Clause>
        <Clause label="C. Google Drive information.">
          With the permissions you or your administrator grant, we access
          information about files in Google Drive: file identifiers, titles,
          folder locations, owners, collaborators, sharing settings, file types
          and dates. We keep this information only for files confirmed as
          company files. We do not store the contents of your files. When you
          search, Knohow asks Google in real time and does not keep a copy of
          file contents.
        </Clause>
        <Clause label="D. Google access tokens.">
          The credentials that let Knohow act on your Google account are stored
          encrypted.
        </Clause>
        <Clause label="E. Activity records.">
          A record of actions taken in Knohow, such as sharing, ownership
          transfers, onboarding and offboarding, including who asked for each
          action. This record is tamper-evident so it can be relied on.
        </Clause>
        <Clause label="F. Demo requests.">
          If you ask for a demo, your name, work email and company website.
        </Clause>
        <Clause label="G. Technical information.">
          Sign-in cookies that keep you logged in, and basic logs such as IP
          address, browser type and error reports that we use to run and secure
          the Service.
        </Clause>
      </Section>

      <Section n={3} title="Company, personal and external files">
        <Clause>
          Knohow is designed to tell company files apart from your own files,
          and to keep the two separate.
        </Clause>
        <List>
          <li>
            <strong>Company files</strong> belong to your organization. A file
            becomes a company file only when it is proposed and then confirmed
            by an authorized person in your organization, or when it is stored
            in your organization&rsquo;s shared drive.
          </li>
          <li>
            <strong>Personal files</strong> are your own, non-company files.
            They are never shown to your organization, including its owners and
            leaders. Once a file is identified as personal, we discard its
            title, location and other details, and we don&rsquo;t keep them in
            logs, caches or training data.
          </li>
          <li>
            <strong>External files</strong> are owned by people outside your
            organization. Knohow does not treat them as belonging to your
            organization or to you.
          </li>
          <li>
            <strong>Private files</strong> are company files restricted from
            your coworkers. People with the right role in your organization may
            still see them.
          </li>
        </List>
        <Clause>
          While a file is still undecided, we keep only its identifier, its
          suggested classification and structured reasons, not its title or
          location. When someone reviews it, we fetch those details from Google
          at that moment and don&rsquo;t keep them. Undecided entries that are
          never reviewed are deleted after a set period.
        </Clause>
        <Callout>
          <p className="m-0">
            If a file is personal, your organization never sees it, and we
            don&rsquo;t keep its name or location.
          </p>
        </Callout>
      </Section>

      <Section n={4} title="How we use information">
        <List>
          <li>to provide the Service, including sign-in and Google Workspace features;</li>
          <li>to suggest how files should be classified, for you to review;</li>
          <li>
            to carry out actions your organization authorizes, such as sharing
            files or transferring ownership during offboarding;
          </li>
          <li>to keep an accurate record of those actions;</li>
          <li>to secure the Service and prevent misuse;</li>
          <li>to respond to demo requests and support questions; and</li>
          <li>to meet our legal obligations.</li>
        </List>
      </Section>

      <Section n={5} title="Automated classification and AI">
        <Clause>
          Knohow uses the least invasive method that works. It starts with rules
          based on file information such as folder, owner and collaborators,
          then small models on that same information. It only looks more deeply,
          or uses AI, for files those methods can&rsquo;t decide. The result is
          always a suggestion with reasons; a person makes the decision. We do
          not use your information to train models without your explicit
          consent.
        </Clause>
      </Section>

      <Section n={6} title="Google user data">
        <Clause>
          Knohow&rsquo;s use and transfer to any other app of information
          received from Google APIs will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className={LINK_CLASS}
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. In particular, we:
        </Clause>
        <List>
          <li>use Google user data only to provide and improve Knohow&rsquo;s features for you;</li>
          <li>do not sell Google user data or use it for advertising;</li>
          <li>
            do not use Google user data to develop, improve or train generalized
            AI or machine-learning models; and
          </li>
          <li>
            do not allow people to read it unless you ask us to, it is needed
            for security or to comply with law, or it has been aggregated and
            anonymized for internal operations.
          </li>
        </List>
        <Clause>
          You can remove Knohow&rsquo;s access at any time from your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            className={LINK_CLASS}
          >
            Google Account permissions
          </a>
          .
        </Clause>
      </Section>

      <Section n={7} title="How we share information">
        <Clause>We do not sell personal information. We share it only:</Clause>
        <List>
          <li>
            within your organization, according to the roles it sets, and never
            including your personal files;
          </li>
          <li>
            with service providers who help us run Knohow, such as cloud
            hosting, database, email and Google&rsquo;s APIs, under agreements
            that protect it;
          </li>
          <li>when required by law or to protect rights and safety; and</li>
          <li>
            as part of a merger, acquisition or sale of assets, subject to this
            policy.
          </li>
        </List>
      </Section>

      <Section n={8} title="Where information is stored">
        <Clause>
          Our service providers may store and process information outside
          Canada, including in the United States. When that happens, the
          information may be subject to the laws of that country.
        </Clause>
      </Section>

      <Section n={9} title="How long we keep information">
        <Clause>
          We keep account and organization information while your account is
          active. Google access tokens are deleted when access is revoked or
          your account is closed. Activity records are kept as long as needed
          for security and accountability. Demo request details are kept as long
          as needed to follow up with you. Personal-file details are not kept at
          all, as described in section 3.
        </Clause>
      </Section>

      <Section n={10} title="How we protect information">
        <Clause>
          We use safeguards including encryption of Google access tokens, secure
          connections, access limited to each organization&rsquo;s own data,
          and a tamper-evident record of actions. No system is perfectly secure,
          but we work to protect your information and will notify you of a
          breach where the law requires it.
        </Clause>
      </Section>

      <Section n={11} title="Cookies">
        <Clause>
          Knohow uses cookies that are needed to keep you signed in. We do not
          use advertising cookies.
        </Clause>
      </Section>

      <Section n={12} title="Your rights and choices">
        <Clause>
          Subject to applicable law, including Canada&rsquo;s{" "}
          <em>Personal Information Protection and Electronic Documents Act</em>{" "}
          and Alberta&rsquo;s <em>Personal Information Protection Act</em>, you
          can ask to access or correct your personal information, withdraw
          consent, or have your account deleted. Email us at{" "}
          <a href="mailto:info@lojj.io" className={LINK_CLASS}>
            info@lojj.io
          </a>
          . If your information is held on behalf of your organization, we may
          refer your request to it. You can also complain to the Office of the
          Privacy Commissioner of Canada or the Office of the Information and
          Privacy Commissioner of Alberta.
        </Clause>
      </Section>

      <Section n={13} title="Age requirement">
        <Clause>
          Knohow is for people aged 18 and over. We do not knowingly collect
          information from anyone younger.
        </Clause>
      </Section>

      <Section n={14} title="Changes to this policy">
        <Clause>
          We may update this Privacy Policy. We will post the new version with
          an updated effective date and give reasonable notice of material
          changes, for example by email or in the Service.
        </Clause>
      </Section>

      <Section n={15} title="Contact us">
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
