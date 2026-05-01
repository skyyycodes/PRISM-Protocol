"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DOCS_URL } from "@/lib/site-links";
import { WaitlistDialog } from "@/components/landing/waitlist-dialog";

const navLinks = [
  { name: "Tranches",      href: "/#features"      },
  { name: "Waterfall",     href: "/#how-it-works"  },
  { name: "Architecture",  href: "/#infra"          },
  { name: "Integrations",  href: "/#integrations"  },
  { name: "Security",      href: "/#security"      },
  { name: "Blog",          href: "/blog"            },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled 
          ? "top-4 left-4 right-4" 
          : "top-0 left-0 right-0"
      }`}
    >
      <nav 
        className={`mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
        }`}
      >
        <div 
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <span
              className={`relative shrink-0 overflow-hidden transition-all duration-500 ${
                isScrolled ? "h-8 w-8" : "h-11 w-11"
              }`}
            >
              <Image
                src="/logos/prism.png"
                alt="PRISM logo"
                width={240}
                height={160}
                priority
                className={`absolute left-1/2 top-[54%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain transition-all duration-500 ${
                  isScrolled ? "h-28 w-[10.5rem]" : "h-36 w-[13.5rem]"
                }`}
              />
            </span>
            <span className={`font-display tracking-tight transition-all duration-500 ${isScrolled ? "text-xl text-foreground" : "text-2xl text-white"}`}>PRISM</span>
            <span className={`font-mono transition-all duration-500 ${isScrolled ? "text-[10px] mt-0.5 text-muted-foreground" : "text-xs mt-1 text-white/60"}`}>PROTOCOL</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8 lg:gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-sm transition-colors duration-300 relative group ${isScrolled ? "text-foreground/70 hover:text-foreground" : "text-white/70 hover:text-white"}`}
              >
                {link.name}
                <span className={`absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full ${isScrolled ? "bg-foreground" : "bg-white"}`} />
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a href={DOCS_URL} className={`transition-all duration-500 ${isScrolled ? "text-xs text-foreground/70 hover:text-foreground" : "text-sm text-white/70 hover:text-white"}`}>
              View docs
            </a>
            <WaitlistDialog>
              <Button
                size="sm"
                className={`rounded-full transition-all duration-500 ${isScrolled ? "bg-foreground hover:bg-foreground/90 text-background px-4 h-8 text-xs" : "bg-white hover:bg-white/90 text-black px-6"}`}
              >
                Join Waitlist
              </Button>
            </WaitlistDialog>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 backdrop-blur transition-colors duration-500 md:hidden ${isScrolled || isMobileMenuOpen ? "text-foreground" : "text-white"}`}
            aria-label="Toggle menu"
          >
            <span className="relative h-4 w-5" aria-hidden="true">
              <span
                className={`absolute left-0 top-0 h-px w-5 bg-current transition-transform ${
                  isMobileMenuOpen ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-2 h-px w-5 bg-current transition-opacity ${
                  isMobileMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-4 h-px w-5 bg-current transition-transform ${
                  isMobileMenuOpen ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>

      </nav>
      
      {/* Mobile Menu - Full Screen Overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${
          isMobileMenuOpen 
            ? "opacity-100 pointer-events-auto" 
            : "opacity-0 pointer-events-none"
        }`}
        style={{ top: 0 }}
      >
        <div className="flex h-full flex-col px-6 pb-6 pt-24 sm:px-8 sm:pb-8 sm:pt-28">
          {/* Navigation Links */}
          <div className="flex flex-1 flex-col justify-center gap-5 sm:gap-8">
            {navLinks.map((link, i) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-display text-4xl text-foreground transition-all duration-500 hover:text-muted-foreground sm:text-5xl ${
                  isMobileMenuOpen 
                    ? "opacity-100 translate-y-0" 
                    : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </Link>
            ))}
          </div>
          
          {/* Bottom CTAs */}
          <div className={`grid gap-3 border-t border-foreground/10 pt-6 transition-all duration-500 sm:grid-cols-2 sm:gap-4 sm:pt-8 ${
            isMobileMenuOpen 
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            <Button
              asChild
              variant="outline"
              className="h-13 rounded-full text-base sm:h-14"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <a href={DOCS_URL}>View docs</a>
            </Button>
            <WaitlistDialog>
              <Button
                className="h-13 rounded-full bg-foreground text-base text-background sm:h-14"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Join Waitlist
              </Button>
            </WaitlistDialog>
          </div>
        </div>
      </div>
    </header>
  );
}
