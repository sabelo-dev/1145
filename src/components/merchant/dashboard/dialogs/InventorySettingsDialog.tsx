import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InventorySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

export const InventorySettingsDialog: React.FC<InventorySettingsDialogProps> = ({ 
  open, 
  onOpenChange, 
  storeId 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    auto_restock_enabled: false,
    restock_threshold: 10,
    restock_quantity: 50,
    notifications_enabled: true,
    notification_threshold: 10
  });

  useEffect(() => {
    if (open && storeId) {
      fetchSettings();
    }
  }, [open, storeId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_settings')
        .select('*')
        .eq('store_id', storeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('inventory_settings')
        .upsert({
          store_id: storeId,
          ...settings
        }, {
          onConflict: 'store_id'
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Inventory settings have been updated successfully."
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inventory Settings</DialogTitle>
          <DialogDescription>
            Configure automatic restocking and notification preferences.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Restock</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically mark items for restock when low
                </p>
              </div>
              <Switch
                checked={settings.auto_restock_enabled}
                onCheckedChange={(checked) => 
                  setSettings({...settings, auto_restock_enabled: checked})
                }
              />
            </div>

            {settings.auto_restock_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="restock-threshold">Restock Threshold</Label>
                  <Input
                    id="restock-threshold"
                    type="number"
                    min="1"
                    value={settings.restock_threshold}
                    onChange={(e) => 
                      setSettings({...settings, restock_threshold: parseInt(e.target.value) || 10})
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Trigger restock when stock falls below this number
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restock-quantity">Restock Quantity</Label>
                  <Input
                    id="restock-quantity"
                    type="number"
                    min="1"
                    value={settings.restock_quantity}
                    onChange={(e) => 
                      setSettings({...settings, restock_quantity: parseInt(e.target.value) || 50})
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Default quantity to order when restocking
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Stock Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about low stock levels
                </p>
              </div>
              <Switch
                checked={settings.notifications_enabled}
                onCheckedChange={(checked) => 
                  setSettings({...settings, notifications_enabled: checked})
                }
              />
            </div>

            {settings.notifications_enabled && (
              <div className="space-y-2">
                <Label htmlFor="notification-threshold">Notification Threshold</Label>
                <Input
                  id="notification-threshold"
                  type="number"
                  min="1"
                  value={settings.notification_threshold}
                  onChange={(e) => 
                    setSettings({...settings, notification_threshold: parseInt(e.target.value) || 10})
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Get notified when stock falls below this number
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveSettings} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};