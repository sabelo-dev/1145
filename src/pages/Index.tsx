import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Clock, ArrowRight, Car, Package, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [when, setWhen] = useState("now");

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (pickup) params.set("pickup", pickup);
    if (destination) params.set("destination", destination);
    navigate(`/rides/request?${params.toString()}`);
  };

  return (
    <div ref={ref} className="min-h-screen bg-background text-foreground">
      <SEO
        title="Go anywhere with 1145 — Request a ride"
        description="Request a ride, hop in, and go. Reliable rides in minutes across South Africa with 1145 Lifestyle."
        keywords="ride, taxi, 1145, south africa, book a ride"
      />

      {/* HERO */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
          {/* Left: form */}
          <div className="space-y-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Go anywhere with 1145
            </h1>

            <Tabs defaultValue="ride" className="w-full">
              <TabsList className="bg-transparent p-0 h-auto gap-6 border-b border-border rounded-none w-full justify-start">
                <TabsTrigger
                  value="ride"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 pb-3 text-base font-medium"
                >
                  <Car className="h-4 w-4 mr-2" /> Ride
                </TabsTrigger>
                <TabsTrigger
                  value="package"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 pb-3 text-base font-medium"
                >
                  <Package className="h-4 w-4 mr-2" /> Package
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ride" className="mt-6">
                <form onSubmit={handleRequest} className="space-y-3">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      placeholder="Pickup location"
                      className="pl-12 h-14 text-base bg-muted border-0 rounded-md"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Dropoff location"
                      className="pl-12 h-14 text-base bg-muted border-0 rounded-md"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-muted rounded-md text-base appearance-none border-0 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="now">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                        <option value="later">Pick a date</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <select className="w-full h-14 pl-12 pr-4 bg-muted rounded-md text-base appearance-none border-0 focus:outline-none focus:ring-2 focus:ring-ring">
                        <option>Now</option>
                        <option>In 15 min</option>
                        <option>In 30 min</option>
                        <option>In 1 hour</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button type="submit" size="lg" className="h-12 px-6 text-base font-medium">
                      See prices
                    </Button>
                    <Link to="/login" className="inline-flex items-center h-12 px-2 text-base font-medium underline underline-offset-4">
                      Log in to see recent activity
                    </Link>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="package" className="mt-6">
                <div className="space-y-3">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Sender address" className="pl-12 h-14 text-base bg-muted border-0 rounded-md" />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Recipient address" className="pl-12 h-14 text-base bg-muted border-0 rounded-md" />
                  </div>
                  <Button size="lg" className="h-12 px-6 text-base font-medium" onClick={() => navigate("/rides/request")}>
                    Get a quote
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: map/image mock */}
          <div className="relative aspect-square lg:aspect-[4/5] w-full rounded-2xl overflow-hidden bg-muted">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--primary)/0.05)), radial-gradient(circle at 30% 30%, hsl(var(--primary)/0.35), transparent 55%), radial-gradient(circle at 70% 70%, hsl(var(--primary)/0.25), transparent 50%)",
              }}
            />
            <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 400 400" fill="none">
              <path d="M0 220 Q120 180 200 240 T400 210" stroke="hsl(var(--foreground))" strokeWidth="2" strokeDasharray="6 6" fill="none" />
              <path d="M40 60 Q160 120 260 90 T400 140" stroke="hsl(var(--foreground))" strokeWidth="2" strokeDasharray="6 6" fill="none" />
              <circle cx="120" cy="200" r="8" fill="hsl(var(--primary))" />
              <circle cx="300" cy="150" r="8" fill="hsl(var(--foreground))" />
            </svg>
            <div className="absolute bottom-6 left-6 right-6 bg-background/90 backdrop-blur rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Arriving in 3 min</p>
                  <p className="text-xs text-muted-foreground">1145X · Toyota Corolla · CA 123-456</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUGGESTIONS */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-8">Suggestions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: "Ride", desc: "Get around town", icon: Car, href: "/rides/request" },
              { title: "Reserve", desc: "Plan ahead", icon: Calendar, href: "/rides/request" },
              { title: "Package", desc: "Send parcels", icon: Package, href: "/rides/request" },
              { title: "Shop", desc: "Marketplace", icon: Package, href: "/shop" },
            ].map((s) => (
              <Link
                key={s.title}
                to={s.href}
                className="group bg-muted hover:bg-muted/70 transition rounded-xl p-5 flex flex-col justify-between min-h-[140px]"
              >
                <s.icon className="h-8 w-8 text-foreground" />
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* DRIVE/EARN */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center order-2 lg:order-1">
            <Users className="h-24 w-24 text-primary/60" />
          </div>
          <div className="order-1 lg:order-2 space-y-5">
            <h2 className="text-3xl sm:text-4xl font-bold">Drive when you want, make what you need</h2>
            <p className="text-muted-foreground text-lg">
              Make money on your schedule with deliveries or trips — or both. Earn with a car, scooter, or bike.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/driver/register">
                <Button size="lg" className="h-12 px-6">Get started</Button>
              </Link>
              <Link to="/driver/login" className="inline-flex items-center h-12 px-2 underline underline-offset-4 font-medium">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-10">The 1145 you know, reimagined for South Africa</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Safety first", desc: "PIN verified trips, panic button, and real-time tracking on every ride." },
              { icon: Car, title: "Reliable arrivals", desc: "Smart dispatch matches you with the closest driver in seconds." },
              { icon: Package, title: "Beyond rides", desc: "Send packages, shop the marketplace, and earn UCoin rewards." },
            ].map((f) => (
              <div key={f.title} className="bg-muted rounded-xl p-6 space-y-4">
                <f.icon className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to move?</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Sign up in minutes and get where you need to go — or start earning today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button size="lg" className="h-12 px-8">Sign up to ride</Button></Link>
            <Link to="/driver/register"><Button size="lg" variant="outline" className="h-12 px-8">Sign up to drive</Button></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
