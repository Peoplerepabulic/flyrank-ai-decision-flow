import "./globals.css";

export const metadata = {
  title: "AI Decision Flow — FlyRank",
  description:
    "Visual AI workflow builder: each node is an LLM decision returning YES or NO, executed via Inngest.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
