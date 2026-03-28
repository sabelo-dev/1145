

## Plan: Add Influencer & Hotel/Lodging Services

### Summary
Add two new service cards to the Service Hub, create a Hotel/Lodging booking system, and integrate it into the consumer dashboard's leasing section.

---

### 1. Add Two Service Cards to Service Hub

**File: `src/pages/ServiceHubPage.tsx`**

Add to the `services` array:

- **Influence** — icon: `Users` (or `Megaphone`), route: `/influencer/login`, tag: "Create", gradient: pink/fuchsia. Redirects to influencer login/dashboard where they set up their professional profile.
- **Stay** — icon: `Hotel` (or `Building2`), route: `/stays`, tag: "New", gradient: warm/sky. Takes users to a hotel/lodging booking page.

---

### 2. Hotel/Lodging Booking System

#### Database Migration
Create tables:
- **`lodging_properties`** — id, owner_id (references profiles), name, description, type (enum: hotel, airbnb, guesthouse, lodge, hostel), location, address, city, province, country, latitude, longitude, images (jsonb), amenities (jsonb), rating, review_count, price_per_night, currency, max_guests, bedrooms, bathrooms, check_in_time, check_out_time, cancellation_policy, is_active, created_at, updated_at
- **`lodging_bookings`** — id, property_id, user_id, check_in, check_out, guests, total_price, status (pending/confirmed/checked_in/checked_out/cancelled), payment_status, special_requests, created_at, updated_at
- **`lodging_reviews`** — id, booking_id, property_id, user_id, rating, comment, created_at

RLS policies for authenticated users to manage their own bookings, property owners to manage listings.

#### New Pages & Components

- **`src/pages/StaysPage.tsx`** — Browse lodging listings with filters (location, dates, guests, price range, property type). Grid of property cards with images, price/night, rating, quick book CTA.
- **`src/pages/StayDetailPage.tsx`** — Full property detail: image gallery, amenities grid, availability calendar, booking form, reviews section, map location.
- **`src/components/stays/PropertyCard.tsx`** — Card component with image carousel, price badge, rating stars, location tag.
- **`src/components/stays/BookingForm.tsx`** — Date picker (check-in/out), guest count, price breakdown, book now button.
- **`src/components/stays/StaysSearchBar.tsx`** — Location search, date range, guest count — similar to Airbnb search bar.

#### Routes (App.tsx)
```
/stays → StaysPage (browse)
/stays/:propertyId → StayDetailPage (detail + book)
```

---

### 3. Integrate into Consumer Dashboard

**File: `src/pages/ConsumerDashboard.tsx`**

Add a new sidebar item:
- **"My Stays"** — icon: `Building2`, id: `stays`

**New Component: `src/components/consumer/dashboard/ConsumerStays.tsx`**
- Shows upcoming/past bookings
- Booking status cards (confirmed, checked-in, completed)
- Quick actions: view details, cancel, leave review
- Stats: total stays, upcoming, amount spent

---

### 4. Add to Navigation

**File: `src/components/layout/header/Navigation.tsx`**
- Add "Stays" link pointing to `/stays`

---

### Technical Details

- **7 new files**: StaysPage, StayDetailPage, PropertyCard, BookingForm, StaysSearchBar, ConsumerStays, migration SQL
- **4 edited files**: ServiceHubPage (2 service cards), App.tsx (routes), ConsumerDashboard (sidebar + module), Navigation (nav link)
- **1 migration**: lodging_properties, lodging_bookings, lodging_reviews tables with RLS
- Uses existing Shadcn Calendar/Datepicker for date selection with `pointer-events-auto`
- Property images stored as jsonb array (URLs from Supabase storage)

