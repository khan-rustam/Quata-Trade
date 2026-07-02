export default function TermsPage(): React.JSX.Element {
  return (
    <article className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Terms of Service</h1>
      <p className="text-sm text-text-3">Placeholder — final terms to be reviewed with legal counsel before launch.</p>
      <div className="space-y-3 text-sm leading-relaxed text-text-2">
        <p>
          QuataTrade is a peer-to-peer marketplace where users trade USDT with one another. Fiat payment happens
          off-platform through your own mobile-money or wallet app; QuataTrade never holds fiat.
        </p>
        <p>
          Every trade is protected by escrow: the seller&rsquo;s crypto is locked until they confirm your payment. Do
          not release escrow until you have confirmed the funds in your own account — a screenshot is not money.
        </p>
        <p>
          You are responsible for the accuracy of your payment details and for complying with local law. Disputes are
          resolved by human review. QuataTrade may pause trading or withdrawals to protect users.
        </p>
      </div>
    </article>
  );
}
