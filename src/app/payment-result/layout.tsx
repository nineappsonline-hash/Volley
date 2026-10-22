import type { Metadata } from "next";

// Transactional status page keyed by ?order=<uuid>. It has no standalone
// content to rank on, so keep it out of the index and follow its links.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function PaymentResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
