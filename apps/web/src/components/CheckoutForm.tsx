"use client";

export function CheckoutForm() {
  return (
    <form
      style={{
        display: "grid",
        gap: 12,
        maxWidth: 420,
        marginTop: 24
      }}
    >
      <input
        aria-label="Venue ID"
        placeholder="Venue ID"
        style={{ padding: 12, borderRadius: 12, border: "1px solid #475569" }}
      />
      <input
        aria-label="Recipient wallets"
        placeholder="Recipient wallets"
        style={{ padding: 12, borderRadius: 12, border: "1px solid #475569" }}
      />
      <button
        type="button"
        style={{
          padding: 12,
          borderRadius: 12,
          border: 0,
          background: "#c96f3b",
          color: "#111827",
          fontWeight: 700
        }}
      >
        Build transaction
      </button>
    </form>
  );
}
