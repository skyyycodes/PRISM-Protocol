"use client";

import { useEffect, useState, useRef } from "react";

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="integrations" ref={sectionRef} className="relative min-h-screen overflow-hidden">

      {/* Header — centré verticalement sur l'image */}
      <div className="relative z-10 pt-20 lg:pt-24 text-center">
        <span className={`inline-flex items-center gap-4 text-sm font-mono text-muted-foreground mb-5 transition-all duration-700 justify-center ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          <span className="w-12 h-px bg-foreground/20" />
          Ecosystem
          <span className="w-12 h-px bg-foreground/20" />
        </span>

        <h2 className={`text-6xl md:text-7xl lg:text-[112px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          Connect
          <br />
          <span className="text-muted-foreground">the credit stack.</span>
        </h2>

        <p className={`mt-5 text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto transition-all duration-1000 delay-100 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}>
          Oracle triggers, analytics surfaces, privacy layers, and market makers can plug into PRISM without changing the vault accounting core.
        </p>
      </div>

      {/* Full-width image */}
      <div className={`absolute left-1/2 bottom-0 w-screen -translate-x-1/2 transition-all duration-1000 delay-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}>
        <img
          src="/images/connection-hands.png"
          alt=""
          aria-hidden="true"
          className="block w-screen max-w-none h-auto"
        />
      </div>

    </section>
  );
}
