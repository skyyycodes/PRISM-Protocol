import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, FileText, ShieldAlert } from "lucide-react";
import { FooterSection } from "@/components/landing/footer-section";
import { Navigation } from "@/components/landing/navigation";
import { DOCS_URL, TWITTER_URL } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The legal terms governing access to and use of the PRISM Protocol website, documentation, and demonstration application.",
};

const EFFECTIVE_DATE = "June 1, 2026";

const ACCENTS = ["#eca8d6", "#a78bfa", "#67e8f9", "#fbbf24"];

type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

type Section = {
  id: string;
  title: string;
  body: Block[];
};

const sections: Section[] = [
  {
    id: "agreement",
    title: "Agreement to Terms",
    body: [
      {
        type: "p",
        text: 'These Terms of Service ("Terms") govern your access to and use of the PRISM Protocol website, documentation, demonstration application, smart contracts, and related interfaces (collectively, the "Protocol"). By accessing or using any part of the Protocol, you agree to be bound by these Terms. If you do not agree, do not use the Protocol.',
      },
      {
        type: "p",
        text: "PRISM Protocol is an experimental, open-source project. These Terms apply to every visitor, user, and contributor, and supplement — but do not replace — any license that governs the Protocol's source code.",
      },
    ],
  },
  {
    id: "demonstration",
    title: "Demonstration Software",
    body: [
      {
        type: "p",
        text: "PRISM Protocol is currently a research and demonstration project deployed on Solana devnet and associated test networks. It is provided solely for evaluation, education, and demonstration purposes.",
      },
      {
        type: "p",
        text: "The Protocol does not custody, transfer, or process real funds. All tokens, tranches, balances, yields, and credit events shown in the application are simulated using valueless test-network assets. Nothing in the Protocol constitutes a live financial product.",
      },
      {
        type: "p",
        text: "Functionality may change, break, or be removed without notice. Test networks may be reset, and any state — including simulated positions — may be erased at any time.",
      },
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    body: [
      {
        type: "p",
        text: "You must be of legal age to form a binding contract in your jurisdiction and have the legal capacity to agree to these Terms.",
      },
      {
        type: "p",
        text: "You may not use the Protocol if you are located in, or are a resident or national of, any jurisdiction subject to comprehensive sanctions, or if you are otherwise prohibited from using such software under applicable law. You are responsible for ensuring your use of the Protocol complies with all laws and regulations that apply to you.",
      },
    ],
  },
  {
    id: "no-advice",
    title: "No Financial, Investment, or Legal Advice",
    body: [
      {
        type: "p",
        text: "The Protocol, its documentation, and all related content are provided for informational purposes only. Nothing presented constitutes financial, investment, legal, accounting, or tax advice, or a recommendation to enter into any transaction.",
      },
      {
        type: "p",
        text: "Tranche structures, yield figures, risk layers, and analytics are illustrative models of how programmable credit could work. They are not projections, guarantees, or solicitations. You are solely responsible for your own decisions and should consult qualified professionals before relying on any concept presented here.",
      },
    ],
  },
  {
    id: "no-securities",
    title: "No Offer of Securities",
    body: [
      {
        type: "p",
        text: "Nothing in the Protocol constitutes an offer, solicitation, or invitation to buy, sell, or subscribe for any security, financial instrument, token, or investment in any jurisdiction.",
      },
      {
        type: "p",
        text: "The tranche tokens and related instruments referenced in the demonstration are test-network artifacts with no monetary value, and confer no ownership, equity, debt, dividend, or claim of any kind.",
      },
    ],
  },
  {
    id: "risk",
    title: "Assumption of Risk",
    body: [
      {
        type: "p",
        text: "Blockchain-based and decentralized-finance software is inherently experimental and carries significant risk. By using the Protocol you acknowledge and accept these risks, including but not limited to:",
      },
      {
        type: "list",
        items: [
          "Smart contracts may contain bugs, vulnerabilities, or unexpected behavior, and have not been formally audited.",
          "Blockchain transactions are irreversible, and network conditions may cause delays, failures, or loss of state.",
          "Cross-chain bridges, oracles, and third-party components may fail, be compromised, or behave unpredictably.",
          "Cryptographic keys, wallets, and dWallets are your responsibility; loss of access cannot be recovered by us.",
        ],
      },
      {
        type: "p",
        text: "You use the Protocol at your own risk and are solely responsible for any consequences arising from that use.",
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    body: [
      {
        type: "p",
        text: "You agree not to use the Protocol to:",
      },
      {
        type: "list",
        items: [
          "Violate any applicable law, regulation, or third-party right.",
          "Attempt to exploit, attack, overload, or gain unauthorized access to the Protocol, its infrastructure, or other users.",
          "Reverse-engineer or interfere with the Protocol other than as permitted by its open-source license.",
          "Misrepresent the Protocol as a production financial service, or use it to defraud or mislead others.",
        ],
      },
    ],
  },
  {
    id: "ip",
    title: "Intellectual Property & Open Source",
    body: [
      {
        type: "p",
        text: "The PRISM name, logo, and brand assets are the property of their respective owners and may not be used without permission.",
      },
      {
        type: "p",
        text: "Source code released by the project is made available under the license stated in its public repository, and your use of that code is governed by that license. Where these Terms and an applicable open-source license conflict with respect to the licensed code, the open-source license controls for that code.",
      },
    ],
  },
  {
    id: "third-party",
    title: "Third-Party Services",
    body: [
      {
        type: "p",
        text: "The Protocol integrates with and references independent third-party networks and services, including Solana, IKA Network, and analytics or privacy providers. We do not control and are not responsible for these services.",
      },
      {
        type: "p",
        text: "Your use of any third-party service is subject to that party's own terms and policies. References to third parties do not imply endorsement or partnership unless expressly stated.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    body: [
      {
        type: "p",
        text: "The Protocol is designed to minimize the personal data it collects. The public website may use basic, privacy-respecting analytics to understand aggregate usage. Interactions you broadcast to a public blockchain are, by nature, public and permanent.",
      },
      {
        type: "p",
        text: "Do not submit sensitive personal information through the Protocol. Where you voluntarily provide a contact detail — for example, an email to join a waitlist — it will be used only for the purpose for which you provided it.",
      },
    ],
  },
  {
    id: "warranties",
    title: "Disclaimer of Warranties",
    body: [
      {
        type: "p",
        text: 'The Protocol is provided "as is" and "as available," without warranties of any kind, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement.',
      },
      {
        type: "p",
        text: "We do not warrant that the Protocol will be uninterrupted, secure, accurate, or error-free, or that any defects will be corrected.",
      },
    ],
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    body: [
      {
        type: "p",
        text: "To the maximum extent permitted by law, the project, its contributors, and its affiliates shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, data, goodwill, or assets, arising from or related to your use of the Protocol.",
      },
      {
        type: "p",
        text: "Because the Protocol is a free, experimental demonstration provided without charge, the aggregate liability of the project and its contributors for any claim relating to the Protocol shall not exceed one hundred U.S. dollars (US$100).",
      },
    ],
  },
  {
    id: "indemnification",
    title: "Indemnification",
    body: [
      {
        type: "p",
        text: "You agree to indemnify and hold harmless the project and its contributors from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising out of your use of the Protocol, your violation of these Terms, or your violation of any law or third-party right.",
      },
    ],
  },
  {
    id: "changes",
    title: "Changes to the Terms and the Protocol",
    body: [
      {
        type: "p",
        text: 'We may update these Terms from time to time. The "Effective date" above indicates when the current version took effect. Material changes will be reflected by updating this page, and your continued use of the Protocol after changes take effect constitutes acceptance.',
      },
      {
        type: "p",
        text: "We may modify, suspend, or discontinue any part of the Protocol at any time — including during and after the hackathon or demonstration period — without notice or liability.",
      },
    ],
  },
  {
    id: "governing",
    title: "Governing Principles & Disputes",
    body: [
      {
        type: "p",
        text: "These Terms, and any dispute arising from them, will be governed by general principles of applicable law without regard to conflict-of-law rules. Where a specific governing jurisdiction is required, it will be the jurisdiction of the project's principal contributors.",
      },
      {
        type: "p",
        text: "You agree to first attempt to resolve any dispute informally by contacting us before pursuing any formal proceeding.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      {
        type: "p",
        text: "Questions about these Terms can be directed to the project through the channels listed on our website, including our X (Twitter) account and documentation portal.",
      },
    ],
  },
];

function BlockList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-7 text-muted-foreground">
          <span className="mt-3 h-px w-6 shrink-0 bg-[#eca8d6]/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <Navigation />

      {/* Hero */}
      <section className="relative flex min-h-[58svh] items-end overflow-hidden border-b border-foreground/10 bg-black pt-28 lg:min-h-[48svh]">
        <div className="absolute inset-0">
          <Image
            src="/images/permissions.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-50 brightness-105 contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-black/10 to-black/40" />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:120px_120px]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 pb-12 pt-24 lg:px-12 lg:pb-14">
          <div className="max-w-[980px]">
            <div className="mb-5 flex items-center gap-4 font-mono text-sm uppercase text-white/55 lg:mb-4">
              <span className="h-px w-12 bg-white/25" />
              Legal
            </div>

            <h1 className="font-display text-5xl leading-[0.94] text-white md:text-7xl lg:text-[6rem]">
              Terms of Service
            </h1>

            {/* Prism spectrum accent line */}
            <div
              className="mt-7 h-px w-full max-w-md"
              style={{
                background:
                  "linear-gradient(90deg, #eca8d6 0%, #a78bfa 33%, #67e8f9 66%, #fbbf24 100%)",
              }}
            />

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60 md:text-xl">
              The terms below govern your access to and use of the PRISM Protocol
              website, documentation, and demonstration application. Please read
              them carefully.
            </p>

            <div className="mt-9 grid max-w-2xl grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["Effective", EFFECTIVE_DATE],
                ["Status", "Devnet demo"],
                ["Version", "1.0"],
              ].map(([label, value]) => (
                <div key={label} className="bg-black/65 p-3 backdrop-blur-sm lg:p-4">
                  <div className="font-mono text-xs uppercase text-white/45">{label}</div>
                  <div className="mt-1 font-display text-xl text-white lg:text-2xl">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demonstration notice band */}
      <section className="border-b border-foreground/10 px-6 py-8 md:px-10 lg:px-12">
        <div className="mx-auto flex max-w-[1400px] items-start gap-4 border border-[#fbbf24]/25 bg-[#fbbf24]/[0.04] p-5 lg:p-6">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border border-[#fbbf24]/35 bg-black text-[#fbbf24]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            <span className="font-medium text-foreground">PRISM Protocol is a demonstration.</span>{" "}
            It runs on Solana devnet and handles no real funds. Every balance, tranche,
            yield figure, and credit event you see is simulated with valueless
            test-network assets. Nothing here is a financial product, investment offer,
            or solicitation.
          </p>
        </div>
      </section>

      {/* Contents + sections */}
      <section className="mx-auto max-w-[1400px] px-6 py-16 md:px-10 lg:px-12 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Sticky table of contents */}
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="lg:sticky lg:top-28">
              <div className="mb-4 flex items-center gap-3 font-mono text-xs uppercase text-muted-foreground">
                <FileText className="h-4 w-4" />
                Contents
              </div>
              <nav className="flex flex-col">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-baseline gap-3 border-l border-foreground/10 py-1.5 pl-4 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    <span className="font-mono text-xs text-foreground/30 group-hover:text-foreground/60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-snug">{section.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Sections */}
          <div className="lg:col-span-8 lg:col-start-5">
            <div className="space-y-14 lg:space-y-16">
              {sections.map((section, index) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-28 lg:scroll-mt-32"
                >
                  <div className="mb-5 flex items-center gap-4">
                    <span
                      className="font-mono text-sm"
                      style={{ color: ACCENTS[index % ACCENTS.length] }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px w-8 bg-foreground/15" />
                  </div>

                  <h2 className="font-display text-3xl leading-[1.05] text-foreground md:text-4xl">
                    {section.title}
                  </h2>

                  <div className="mt-5 space-y-5">
                    {section.body.map((block, i) =>
                      block.type === "p" ? (
                        <p key={i} className="text-base leading-7 text-muted-foreground">
                          {block.text}
                        </p>
                      ) : (
                        <BlockList key={i} items={block.items} />
                      )
                    )}
                  </div>
                </article>
              ))}

              {/* Acknowledgement footer line */}
              <div className="border-t border-foreground/10 pt-8">
                <p className="text-sm leading-7 text-muted-foreground">
                  By continuing to use the Protocol, you acknowledge that you have read,
                  understood, and agreed to these Terms.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-foreground/15 px-5 py-3 font-mono text-sm text-foreground transition-colors hover:border-[#eca8d6]/70 hover:text-[#eca8d6]"
                  >
                    Read the docs
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <a
                    href={TWITTER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-foreground/15 px-5 py-3 font-mono text-sm text-foreground transition-colors hover:border-[#67e8f9]/70 hover:text-[#67e8f9]"
                  >
                    Contact us
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
