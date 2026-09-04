# Seed Data Reference

Run `npm run db:seed --workspace=@wag/api` to populate all of the below.

## Users

| Role | Name | Login | Notes |
|---|---|---|---|
| Admin | Admin Wag | admin@wagandtails.in / WagTails@123 | Full admin console access |
| Staff | Priya Operations | staff@wagandtails.in / WagTails@123 | Staff portal access |
| Customer | Arjun Mehta | +919876543210 (OTP) | Has Simba |
| Customer | Sahana Krishnamurthy | +919876543211 (OTP) | Has Mochi |
| Customer | Rohan Verma | +919876543212 (OTP) | Has Rio |
| Partner | Ritika Sharma | ritika.sharma@wagpartner.in / Partner@123 | Grooming only, ⭐4.9 |
| Partner | Aman Verma | aman.verma@wagpartner.in / Partner@123 | Grooming + Walking, ⭐4.8 |
| Partner | Neha Pillai | neha.pillai@wagpartner.in / Partner@123 | Grooming only, ⭐4.7 |
| Partner | Karan Joshi | karan.joshi@wagpartner.in / Partner@123 | Walking only, ⭐4.9 |

## Pets

| Name | Owner | Breed | Notable care notes |
|---|---|---|---|
| Simba | Arjun | Golden Retriever | Hot spot near left ear. Hypoallergenic shampoo only. Sensitive to chicken. |
| Mochi | Sahana | Shih Tzu | Take breaks during grooming after 45 min. Trim paw fur short. |
| Rio | Rohan | Beagle | Use slip-lead only — chews leash. Grain-sensitive. |

## Grooming packages

| Name | MRP | Price | Savings |
|---|---|---|---|
| Basic | ₹1,200 | ₹999 | 17% |
| Bath + Basic | ₹1,800 | ₹1,299 | 28% |
| Standard | ₹1,800 | ₹1,399 | 22% |
| Premium | ₹2,499 | ₹1,699 | 32% |
| Luxury | ₹3,000 | ₹2,199 | 27% |

## Add-ons

| Name | Price |
|---|---|
| Tick removal by hand | ₹300 |
| De-matting | ₹300 |
| Medicated bath | ₹300 |
| Normal bath | ₹200 |

## Walk pricing

| Duration | Price |
|---|---|
| 30 min | ₹249 |
| 45 min | ₹349 |
| 60 min | ₹449 |

## Coupons

| Code | Discount | Applicable | Limit |
|---|---|---|---|
| WAGWELCOME | ₹200 flat | Grooming | 1 per user |
| WALKFIRST | ₹50 flat | Walking | 1 per user |
| WAG10 | 10% (max ₹300) | All | 3 per user |
| PETSTORE15 | 15% (max ₹500) | Store | — |

## Store categories

Grooming · Food & Treats · Health · Walk Gear · Toys

## Sample bookings

| Type | Pet | Status | Notes |
|---|---|---|---|
| Grooming (Premium) | Simba | Completed | Assigned to Ritika, full history |
| Grooming (Standard) | Mochi | Needs partner | WAGWELCOME coupon applied |
| Walking (30 min) | Rio | Completed | Walk session with Karan, duration 35 min |
