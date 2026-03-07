import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle, Share, MoreVertical } from "lucide-react";
import SEO from "@/components/SEO";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) setIsInstalled(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <>
      <SEO title="Install 1145 Lifestyle App" description="Install the 1145 Lifestyle app on your device for a native shopping experience." />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <img src="/pwa-icon-192.png" alt="1145 Lifestyle" className="w-full h-full object-cover" />
            </div>
            <CardTitle className="text-2xl">Install 1145 Lifestyle</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              Get the full app experience on your device
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-center font-medium">App is already installed!</p>
                <p className="text-sm text-muted-foreground text-center">
                  Open it from your home screen for the best experience.
                </p>
              </div>
            ) : isIOS ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  To install on your iPhone or iPad:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Share className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Tap the <strong>Share</strong> button in Safari</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Download className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Select <strong>"Add to Home Screen"</strong></span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Tap <strong>"Add"</strong> to confirm</span>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="h-5 w-5 mr-2" />
                Install App
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  To install on your Android device:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <MoreVertical className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Tap the <strong>menu</strong> (⋮) in Chrome</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Smartphone className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">Select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong></span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-4 space-y-2">
              <p className="text-xs text-muted-foreground text-center font-medium">Why install?</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Faster loading & offline access</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Full-screen native experience</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500" /> Quick access from home screen</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default InstallPage;
