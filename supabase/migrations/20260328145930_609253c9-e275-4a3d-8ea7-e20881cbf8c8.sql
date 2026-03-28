-- Lodging Properties
CREATE TABLE public.lodging_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'hotel' CHECK (type IN ('hotel', 'airbnb', 'guesthouse', 'lodge', 'hostel')),
  location TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'South Africa',
  latitude NUMERIC,
  longitude NUMERIC,
  images JSONB DEFAULT '[]'::jsonb,
  amenities JSONB DEFAULT '[]'::jsonb,
  rating NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  price_per_night NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'ZAR',
  max_guests INTEGER DEFAULT 2,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  check_in_time TEXT DEFAULT '14:00',
  check_out_time TEXT DEFAULT '11:00',
  cancellation_policy TEXT DEFAULT 'flexible',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.lodging_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.lodging_properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER DEFAULT 1,
  total_price NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  special_requests TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.lodging_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.lodging_bookings(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.lodging_properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lodging_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lodging_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lodging_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active properties" ON public.lodging_properties FOR SELECT USING (is_active = true);
CREATE POLICY "Owners can manage their properties" ON public.lodging_properties FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins can manage all properties" ON public.lodging_properties FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own bookings" ON public.lodging_bookings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create bookings" ON public.lodging_bookings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bookings" ON public.lodging_bookings FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Property owners can view bookings" ON public.lodging_bookings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.lodging_properties WHERE id = property_id AND owner_id = auth.uid()));

CREATE POLICY "Anyone can view reviews" ON public.lodging_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON public.lodging_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_lodging_properties_city ON public.lodging_properties(city);
CREATE INDEX idx_lodging_properties_type ON public.lodging_properties(type);
CREATE INDEX idx_lodging_properties_active ON public.lodging_properties(is_active);
CREATE INDEX idx_lodging_bookings_user ON public.lodging_bookings(user_id);
CREATE INDEX idx_lodging_bookings_property ON public.lodging_bookings(property_id);
CREATE INDEX idx_lodging_reviews_property ON public.lodging_reviews(property_id);

CREATE TRIGGER update_lodging_properties_updated_at BEFORE UPDATE ON public.lodging_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lodging_bookings_updated_at BEFORE UPDATE ON public.lodging_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();