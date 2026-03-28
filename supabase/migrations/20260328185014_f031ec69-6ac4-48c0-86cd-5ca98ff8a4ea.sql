
CREATE TABLE public.user_linked_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  account_number_masked TEXT NOT NULL,
  account_number_hash TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'savings',
  branch_code TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.bank_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.user_linked_bank_accounts(id),
  transfer_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending_verification',
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_verified BOOLEAN DEFAULT false,
  reference TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_linked_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank accounts"
  ON public.user_linked_bank_accounts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own transfer requests"
  ON public.bank_transfer_requests FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_linked_bank_accounts_updated_at
  BEFORE UPDATE ON public.user_linked_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_transfer_requests_updated_at
  BEFORE UPDATE ON public.bank_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
