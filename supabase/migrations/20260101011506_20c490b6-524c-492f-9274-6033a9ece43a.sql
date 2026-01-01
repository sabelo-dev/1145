-- Function to award BiGold to a user
CREATE OR REPLACE FUNCTION award_bigold(
  p_user_id UUID,
  p_category TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_rule RECORD;
  v_amount INTEGER;
  v_wallet_exists BOOLEAN;
BEGIN
  -- Get the earning rule for this category
  SELECT * INTO v_rule 
  FROM bigold_earning_rules 
  WHERE category = p_category AND is_active = true
  LIMIT 1;
  
  -- If no active rule found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate amount with multiplier
  v_amount := v_rule.amount * COALESCE(v_rule.multiplier, 1);
  
  -- Check if wallet exists
  SELECT EXISTS(SELECT 1 FROM bigold_wallets WHERE user_id = p_user_id) INTO v_wallet_exists;
  
  -- Create wallet if it doesn't exist
  IF NOT v_wallet_exists THEN
    INSERT INTO bigold_wallets (user_id, balance, lifetime_earned, lifetime_spent)
    VALUES (p_user_id, 0, 0, 0);
  END IF;
  
  -- Create transaction record
  INSERT INTO bigold_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (p_user_id, v_amount, 'earn', p_category, v_rule.description, p_reference_id, p_reference_type);
  
  -- Update wallet balance
  UPDATE bigold_wallets 
  SET 
    balance = balance + v_amount,
    lifetime_earned = lifetime_earned + v_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for order completion
CREATE OR REPLACE FUNCTION trigger_bigold_order_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if order status changed to 'delivered' or 'completed'
  IF (OLD.status IS DISTINCT FROM NEW.status) AND 
     (NEW.status = 'delivered' OR NEW.status = 'completed') THEN
    -- Award BiGold to the customer
    PERFORM award_bigold(NEW.user_id, 'order_completed', NEW.id, 'order');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for review submission
CREATE OR REPLACE FUNCTION trigger_bigold_review_submitted()
RETURNS TRIGGER AS $$
BEGIN
  -- Award BiGold when a new review is created
  PERFORM award_bigold(NEW.user_id, 'review_submitted', NEW.id, 'review');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function for delivery completion
CREATE OR REPLACE FUNCTION trigger_bigold_delivery_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_user_id UUID;
BEGIN
  -- Check if delivery status changed to 'delivered'
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'delivered' THEN
    -- Get the driver's user_id
    SELECT user_id INTO v_driver_user_id 
    FROM drivers 
    WHERE id = NEW.driver_id;
    
    IF v_driver_user_id IS NOT NULL THEN
      -- Award BiGold to the driver
      PERFORM award_bigold(v_driver_user_id, 'delivery_completed', NEW.id, 'delivery');
      
      -- Check for on-time delivery bonus (if delivered before or at estimated time)
      IF NEW.actual_delivery_time IS NOT NULL AND 
         NEW.estimated_delivery_time IS NOT NULL AND 
         NEW.actual_delivery_time <= NEW.estimated_delivery_time THEN
        PERFORM award_bigold(v_driver_user_id, 'ontime_delivery', NEW.id, 'delivery');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
DROP TRIGGER IF EXISTS bigold_order_completed_trigger ON orders;
CREATE TRIGGER bigold_order_completed_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_bigold_order_completed();

DROP TRIGGER IF EXISTS bigold_review_submitted_trigger ON reviews;
CREATE TRIGGER bigold_review_submitted_trigger
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_bigold_review_submitted();

DROP TRIGGER IF EXISTS bigold_delivery_completed_trigger ON delivery_jobs;
CREATE TRIGGER bigold_delivery_completed_trigger
  AFTER UPDATE ON delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_bigold_delivery_completed();

-- Insert default earning rules if they don't exist
INSERT INTO bigold_earning_rules (category, amount, description, is_active, multiplier)
VALUES 
  ('order_completed', 10, 'Earned for completing an order', true, 1),
  ('review_submitted', 5, 'Earned for submitting a product review', true, 1),
  ('delivery_completed', 15, 'Earned for completing a delivery', true, 1),
  ('ontime_delivery', 10, 'Bonus for on-time delivery', true, 1),
  ('referral_signup', 50, 'Earned when your referral signs up', true, 1),
  ('referral_purchase', 25, 'Earned when your referral makes first purchase', true, 1)
ON CONFLICT (category) DO NOTHING;