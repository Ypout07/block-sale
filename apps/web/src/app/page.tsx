import Link from "next/link";
import { TicketCard } from "@/components/TicketCard";

const routes = [
  { href: "/buy", label: "Buy", description: "Gift and split-purchase flows." },
  { href: "/claim", label: "Claim", description: "Ticket claim and DID verification." },
  { href: "/dashboard", label: "Dashboard", description: "Venue and holder protocol state." }
];

export default function HomePage() {
  return (
    <main style={{ padding: "48px 24px", maxWidth: 1080, margin: "0 auto" }}>
      <section style={{ marginBottom: 32 }}>
        <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", color: "#72bda3" }}>
          Closed-Loop Protocol
        </p>
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", margin: "12px 0" }}>
          XRPL ticketing without a secondary market.
        </h1>
        <p style={{ maxWidth: 720, color: "#cbd5e1", lineHeight: 1.6 }}>
          This starter app is scaffolded around the protocol described in the repository docs:
          DID-gated distribution, venue-controlled returns, and group buys backed by XRPL primitives.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20
        }}
      >
        {routes.map((route) => (
          <TicketCard key={route.href} title={route.label} description={route.description}>
            <Link href={route.href}>Open flow</Link>
          </TicketCard>
        ))}
      </section>
    </main>
  );
}
