import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { Strategies } from "@/components/landing/strategies";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Showcase } from "@/components/landing/showcase";
import { Benefits } from "@/components/landing/benefits";
import { Pricing, Faq } from "@/components/landing/pricing";
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
        <Showcase />
        <Benefits />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
