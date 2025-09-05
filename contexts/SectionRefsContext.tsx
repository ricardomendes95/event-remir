"use client";

import { createContext, useContext, useRef, ReactNode } from "react";

interface SectionRefs {
  eventoRef: React.RefObject<HTMLElement | null>;
  comprovanteRef: React.RefObject<HTMLElement | null>;
}

interface SectionRefsContextType {
  refs: SectionRefs;
  scrollToSection: (ref: React.RefObject<HTMLElement | null>) => void;
}

const SectionRefsContext = createContext<SectionRefsContextType | undefined>(
  undefined
);

export function SectionRefsProvider({ children }: { children: ReactNode }) {
  const eventoRef = useRef<HTMLElement>(null);
  const comprovanteRef = useRef<HTMLElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const value = {
    refs: {
      eventoRef,
      comprovanteRef,
    },
    scrollToSection,
  };

  return (
    <SectionRefsContext.Provider value={value}>
      {children}
    </SectionRefsContext.Provider>
  );
}

export function useSectionRefs() {
  const context = useContext(SectionRefsContext);
  if (context === undefined) {
    throw new Error("useSectionRefs must be used within a SectionRefsProvider");
  }
  return context;
}
