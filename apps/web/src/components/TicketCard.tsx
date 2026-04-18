import type { ReactNode } from "react";

type TicketCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function TicketCard({ title, description, children }: TicketCardProps) {
  return (
    <article
      style={{
        border: "1px solid rgba(248, 241, 229, 0.18)",
        background: "rgba(17, 24, 39, 0.55)",
        borderRadius: 20,
        padding: 24,
        backdropFilter: "blur(12px)"
      }}
    >
      <h2>{title}</h2>
      <p style={{ color: "#cbd5e1", minHeight: 48 }}>{description}</p>
      <div style={{ marginTop: 16, color: "#72bda3" }}>{children}</div>
    </article>
  );
}
