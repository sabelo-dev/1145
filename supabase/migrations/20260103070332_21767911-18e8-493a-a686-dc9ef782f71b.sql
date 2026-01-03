-- Rename bigold tables to ucoin tables
ALTER TABLE public.bigold_wallets RENAME TO ucoin_wallets;
ALTER TABLE public.bigold_transactions RENAME TO ucoin_transactions;
ALTER TABLE public.bigold_earning_rules RENAME TO ucoin_earning_rules;
ALTER TABLE public.bigold_spending_options RENAME TO ucoin_spending_options;

-- Update the award function to use new table names
CREATE OR REPLACE FUNCTION award_ucoin(
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
  FROM ucoin_earning_rules 
  WHERE category = p_category AND is_active = true
  LIMIT 1;
  
  -- If no active rule found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate amount with multiplier
  v_amount := v_rule.amount * COALESCE(v_rule.multiplier, 1);
  
  -- Check if wallet exists
  SELECT EXISTS(SELECT 1 FROM ucoin_wallets WHERE user_id = p_user_id) INTO v_wallet_exists;
  
  -- Create wallet if it doesn't exist
  IF NOT v_wallet_exists THEN
    INSERT INTO ucoin_wallets (user_id, balance, lifetime_earned, lifetime_spent)
    VALUES (p_user_id, 0, 0, 0);
  END IF;
  
  -- Create transaction record
  INSERT INTO ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (p_user_id, v_amount, 'earn', p_category, v_rule.description, p_reference_id, p_reference_type);
  
  -- Update wallet balance
  UPDATE ucoin_wallets 
  SET 
    balance = balance + v_amount,
    lifetime_earned = lifetime_earned + v_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old function
DROP FUNCTION IF EXISTS award_bigold(UUID, TEXT, UUID, TEXT);

-- Update trigger functions to use new award function
CREATE OR REPLACE FUNCTION trigger_ucoin_order_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND 
     (NEW.status = 'delivered' OR NEW.status = 'completed') THEN
    PERFORM award_ucoin(NEW.user_id, 'order_completed', NEW.id, 'order');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trigger_ucoin_review_submitted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_ucoin(NEW.user_id, 'review_submitted', NEW.id, 'review');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trigger_ucoin_delivery_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_user_id UUID;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'delivered' THEN
    SELECT user_id INTO v_driver_user_id 
    FROM drivers 
    WHERE id = NEW.driver_id;
    
    IF v_driver_user_id IS NOT NULL THEN
      PERFORM award_ucoin(v_driver_user_id, 'delivery_completed', NEW.id, 'delivery');
      
      IF NEW.actual_delivery_time IS NOT NULL AND 
         NEW.estimated_delivery_time IS NOT NULL AND 
         NEW.actual_delivery_time <= NEW.estimated_delivery_time THEN
        PERFORM award_ucoin(v_driver_user_id, 'ontime_delivery', NEW.id, 'delivery');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old triggers and create new ones
DROP TRIGGER IF EXISTS bigold_order_completed_trigger ON orders;
DROP TRIGGER IF EXISTS bigold_review_submitted_trigger ON reviews;
DROP TRIGGER IF EXISTS bigold_delivery_completed_trigger ON delivery_jobs;

CREATE TRIGGER ucoin_order_completed_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ucoin_order_completed();

CREATE TRIGGER ucoin_review_submitted_trigger
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ucoin_review_submitted();

CREATE TRIGGER ucoin_delivery_completed_trigger
  AFTER UPDATE ON delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ucoin_delivery_completed();

-- Drop old trigger functions
DROP FUNCTION IF EXISTS trigger_bigold_order_completed();
DROP FUNCTION IF EXISTS trigger_bigold_review_submitted();
DROP FUNCTION IF EXISTS trigger_bigold_delivery_completed();

-- Update the badge awarding function to use award_ucoin
CREATE OR REPLACE FUNCTION award_user_badges(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  badge_record RECORD;
  badges_awarded INTEGER := 0;
  v_order_count INTEGER;
  v_review_count INTEGER;
  v_spent_amount NUMERIC;
  v_referral_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_order_count FROM orders WHERE user_id = p_user_id AND status = 'delivered';
  SELECT COUNT(*) INTO v_review_count FROM reviews WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(total), 0) INTO v_spent_amount FROM orders WHERE user_id = p_user_id AND status = 'delivered';
  SELECT COUNT(*) INTO v_referral_count FROM referrals WHERE referrer_id = p_user_id AND status = 'completed';

  FOR badge_record IN 
    SELECT * FROM badge_definitions WHERE is_active = true
  LOOP
    IF NOT EXISTS (SELECT 1 FROM consumer_badges WHERE user_id = p_user_id AND badge_id = badge_record.id) THEN
      IF (badge_record.requirement_type = 'orders' AND v_order_count >= badge_record.requirement_value) OR
         (badge_record.requirement_type = 'reviews' AND v_review_count >= badge_record.requirement_value) OR
         (badge_record.requirement_type = 'spending' AND v_spent_amount >= badge_record.requirement_value) OR
         (badge_record.requirement_type = 'referrals' AND v_referral_count >= badge_record.requirement_value) THEN
        
        INSERT INTO consumer_badges (user_id, badge_id) VALUES (p_user_id, badge_record.id);
        
        IF badge_record.ucoin_reward > 0 THEN
          PERFORM award_ucoin(p_user_id, 'badge_earned', badge_record.id, 'badge');
        END IF;
        
        badges_awarded := badges_awarded + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN badges_awarded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;