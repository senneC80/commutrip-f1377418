import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MapPin, Users, Compass, ArrowRight } from 'lucide-react';
import heroBg from '@/assets/hero-bg.jpg';

export default function Landing() {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="font-heading font-bold text-xl">CommuTrip</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => navigate('/dashboard')} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>Log In</Button>
                <Button onClick={() => navigate('/auth')} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="Community tourism in rice terraces" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent" />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-32 md:py-44">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold leading-tight mb-6" style={{ color: 'hsl(0, 0%, 100%)' }}>
              Travel with <span className="text-gradient-primary">Communities</span>, Not Crowds
            </h1>
            <p className="text-lg md:text-xl mb-8 leading-relaxed" style={{ color: 'hsl(0, 0%, 90%)' }}>
              Discover authentic, locally-hosted experiences. Build your trip itinerary and get matched with community-based tourism activities.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={handleGetStarted} className="gap-2 bg-gradient-primary hover:opacity-90 text-primary-foreground text-base px-8">
                Get Started <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 border-2" style={{ color: 'hsl(0, 0%, 100%)', borderColor: 'hsl(0, 0%, 100%, 0.4)' }}>
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold text-center mb-4">How CommuTrip Works</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            A smarter way to travel — plan your route, discover local experiences, and support communities.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Compass,
                title: 'Build Your Trip',
                desc: 'Plan your itinerary with stops along your route. CommuTrip will suggest activities at every destination.',
              },
              {
                icon: Users,
                title: 'Meet Local Hosts',
                desc: 'Connect with community providers offering authentic cooking classes, guided hikes, cultural tours, and more.',
              },
              {
                icon: MapPin,
                title: 'Experience & Review',
                desc: 'Book activities, enjoy unique experiences, and share your journey to help fellow travellers.',
              },
            ].map((f) => (
              <div key={f.title} className="text-center p-8 rounded-xl bg-card shadow-card hover:shadow-card-hover transition-shadow">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mb-5">
                  <f.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-heading font-semibold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading font-bold mb-4" style={{ color: 'hsl(0, 0%, 100%)' }}>Ready to explore?</h2>
          <p className="mb-8 max-w-lg mx-auto" style={{ color: 'hsl(0, 0%, 100%, 0.85)' }}>
            Join CommuTrip today — as a traveller looking for meaningful experiences or a local provider sharing your culture.
          </p>
          <Button size="lg" onClick={handleGetStarted} className="bg-card text-foreground hover:bg-card/90 text-base px-8 gap-2">
            Get Started Free <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-background">
        <div className="container mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-heading font-semibold">CommuTrip</span>
          </div>
          <p>&copy; {new Date().getFullYear()} CommuTrip. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
