"use client";
import React from "react";

import { HeroSection } from "@/components/home/HeroSection";
import { Footer } from "@/components/Footer";
import { AboutSection } from "@/components/home/AboutSection";
import { LocationSection } from "@/components/home/LocationSection";
import { MinistriesSection } from "@/components/home/MinistriesSection";
import { PastorsSection } from "@/components/home/PastorsSection";

// Main App Component
const home = () => {
  return (
    <div>
      <main>
        <HeroSection />
        <AboutSection />
        <PastorsSection />
        <MinistriesSection />
        <LocationSection />
      </main>
      <Footer />
    </div>
  );
};

export default home;
