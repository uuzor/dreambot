import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { Strategies } from "@/components/landing/strategies";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Benefits } from "@/components/landing/benefits";
import { Faq } from "@/components/landing/faq";
import { Cta, SiteFooter } from "@/components/landing/cta";

export const metadata: Metadata = {
  title: "Autonomous perps agents on Somnia",
  description:
    "Deploy an autonomous trading agent against your own DreamDEX account. The key it holds can trade, and can never withdraw.",
};

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Strategies />
        <HowItWorks />
        <Benefits />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
