import { HeroSection } from "@/components/hero-section";
import { FeaturesSection } from "@/components/features-section";

// Uncomment these as you confirm their export names:
// import { ProblemSolutionSection } from "@/components/problem-solution-section";
// import { RoiCalculatorSection } from "@/components/roi-calculator-section";
// import { TestimonialsSection } from "@/components/testimonials-section";
// import { CtaSection } from "@/components/cta-section";
// import { Footer } from "@/components/footer";

export default function Page() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      {/* <ProblemSolutionSection /> */}
      {/* <RoiCalculatorSection /> */}
      {/* <TestimonialsSection /> */}
      {/* <CtaSection /> */}
      {/* <Footer /> */}
    </main>
  );
}