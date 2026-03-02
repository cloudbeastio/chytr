import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Features } from '@/components/landing/features'
import { Pricing } from '@/components/landing/pricing'
import { Footer } from '@/components/landing/footer'

export default function RootPage() {
  return (
    <>
      <Navbar />
      <main className="pt-14">
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <Footer />
      </main>
    </>
  )
}
