export default function PrivacyPage(): React.JSX.Element {
  return (
    <article className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-text-3">Placeholder — aligned with Cameroon Law No. 2024/017; final version pending legal review.</p>
      <div className="space-y-3 text-sm leading-relaxed text-text-2">
        <p>
          We collect only what we need to run the platform and meet our legal obligations: your account details,
          verification documents, and transaction records.
        </p>
        <p>
          Verification documents are encrypted, access-audited, and kept only for the legal retention period, then
          purged. We do not use your documents to train AI systems.
        </p>
        <p>
          You can request access to, or deletion of, your personal data within the limits the law allows. Contact
          support to exercise these rights.
        </p>
      </div>
    </article>
  );
}
