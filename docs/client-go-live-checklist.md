# Wag & Tails apps: what we need from you to go live

Date: 27 November 2026

This lists what you need to arrange or send, followed by our questions. You can write your answers directly under each question.

## Before you start

**About the test apps.** Three things in them are only simulated today. We will connect the real services before launch.

- The login code is shown on the screen instead of being sent to your phone. Please **do not forward the test apps** to anyone outside your team: someone who knows a customer's number could sign in as that customer.
- "Pay online" does not take real money.
- The partner identity check (DigiLocker) is not a real check.

**Sending things safely.** Please **never send passwords, secret keys or ID documents by WhatsApp or email.** Where possible, add us as a user on the account. Otherwise we will enter the details together on a call.

**Start these first, because they can take the longest:** the Google Play account (section 1), your choice for login codes (section 3) and your choice for partner identity checks (section 5).

---

## 1. App store accounts

The accounts should be in your business's name, so that you own the apps.

### Google Play (Android)

- [ ] Create a **Google Play Console** account as an **organisation**, in your registered business name. There is a one-time fee (about US$25; please check the amount when you sign up).
- [ ] An organisation account needs a **D-U-N-S number**. This is a free business ID from Dun & Bradstreet, and it can take a few weeks to get.
- [ ] Invite us to the account: **[our email]**.

A *personal* account is not recommended. A new personal account must first run a test with at least 12 people for 14 days in a row before Google lets you apply to publish.

### Apple App Store (only if you want iPhone apps)

- [ ] Join the **Apple Developer Program** as an organisation (US$99 per year).
- [ ] You will need a D-U-N-S number, your exact legal business name, your public website and an email address on your business's own domain.
- [ ] Invite us to the account.

So far we have tested the Android apps only. iPhone apps need their own build and testing.

## 2. Online payments (Razorpay)

- [ ] Confirm your Razorpay account is approved for **live** payments, and whether it is the same one your website uses.
- [ ] Give us secure access so we can set the **live Key ID and Key Secret** on the app server.

## 3. Login codes for customers

Please choose one. Both need some work from us.

| Option | What you need to arrange |
|---|---|
| **A. WhatsApp (we suggest this).** Your website plugin already has login by WhatsApp code. | Confirm it works on your live website today. You need your WhatsApp Business account with Meta and an approved login-code message template. Customers without WhatsApp could not receive a code. |
| **B. SMS** | Register your business for SMS in India (called **DLT registration**): your business, a sender name and the login message must all be approved. You also need an account with an SMS company. DLT usually asks for business PAN, GST number and the authorised signatory's details. Your SMS company will confirm the exact list. |

## 4. WhatsApp booking messages

- [ ] In your website admin panel, open **Settings → WhatsApp templates** and submit these four new messages to Meta:
  - Groomer assigned
  - Groomer on the way (with tracking link and start code)
  - Grooming started (end code)
  - Booking needs the desk
- [ ] Check that WhatsApp is connected on the live website. Please enter the connection details yourself; you do not need to send them to us.
- [ ] Tell us the **email address and WhatsApp number** that should receive desk alerts.

Meta usually approves messages within a few hours. Until then, these four messages will not be sent.

## 5. Partner identity checks

When partners sign up, the app has a **"Verify with DigiLocker"** step. It also asks for their **full Aadhaar number and photos of the card**. We store these encrypted. Only logged-in owner or staff accounts can view them, and each viewing is recorded.

- [ ] **Please ask your legal adviser before launch** whether your business may collect and keep full Aadhaar numbers and card photos. There are legal limits on this for private businesses, and the rules have been changing. Alternatives to ask about include keeping less of the number, accepting a masked card or using another ID.
- [ ] If you want real DigiLocker checks, your business must apply to become a DigiLocker "requester" organisation (through API Setu). You will need an authorised senior representative and an official business email, and must accept their terms. We could not find a published timeline or fee. After approval, we need secure access to the app's DigiLocker details.
- [ ] If you would rather not apply, we can remove the DigiLocker step. Your team would then check each partner's ID before approving them.

## 6. Maps and the pet-care assistant

- [ ] **Ola Maps:** create an account in your business's name, with billing set up, so the maps run on your own account.
- [ ] **Dr. Woof assistant:** it uses Google's Gemini service. Create a Gemini API key on your own Google account, with billing set up.

We will help you set up both and add the keys securely.

## 7. Website and server access

- [ ] Confirm your live website still has **Wag & Tails plugin version 1.16.0**, with no changes since the copy you gave us. If anything has changed, send us the latest copy **before** we install anything.
- [ ] Give us a temporary WordPress admin login (shared securely), or join a call and upload the new plugin with us.
- [ ] Arrange Hostinger access so that we can take a full backup and add two connection lines to the website's settings file (`wp-config.php`).
- [ ] Confirm who owns and pays for the app server (VPS), and keep its backups switched on.
- [ ] Choose a quiet time for us to switch over, such as a late evening.

## 8. Legal pages

The legal text now in the apps is a draft. It needs your approval and possibly changes.

- [ ] **Privacy policy** on a public web page. It should cover customer details, partner ID documents, location during jobs, photos, notifications, the pet-care assistant and account deletion.
- [ ] **Account deletion page** on your website, where someone can ask for their account and data to be deleted. Tell us who will handle these requests. Google also requires a deletion option inside the app, which we will add.
- [ ] **Terms** for customers and for partners, including your cancellation and refund policy.

We can prepare first drafts. Please have your legal adviser check them.

## 9. Play Store page

We will prepare screenshots and draft descriptions for you to approve.

- [ ] Confirm the app names: **Wag & Tails** and **Wag & Tails Partner**.
- [ ] Confirm that **info@wagandtails.in** is checked regularly and can be shown as the support email.
- [ ] Confirm the website address and support phone number to show.
- [ ] Send any logo or promotional artwork you would like us to use.

## 10. Your team and business details

- [ ] **Partners:** for each one, send name, mobile number, email, city, service (grooming, walking or both) and whether they are **My team** or **Freelancer**. Each partner then signs up in the app and adds their own documents and photos. Send names and contact details through a secure share, and no ID documents.
- [ ] **Staff:** for each person who needs the panel, send name, email, city and what they should be allowed to see or change.
- [ ] **Product list:** send your final product sheet.
- [ ] **Go-live test:** arrange one real partner with an Android phone for about 15 minutes.

---

## Our questions

**1. Login codes:** WhatsApp (option A) or SMS (option B)?

Answer:

**2. Partner checks:** Should we keep DigiLocker or remove it? What does your legal adviser say about storing Aadhaar numbers and card photos?

Answer:

**3. iPhone:** Do you need iPhone apps at launch, or Android only?

Answer:

**4. Coupon PAMPER:** It says "10% OFF on your first booking", but the app also offers it to a returning customer. Should it work only on a first booking?

Answer:

**5. Coupon FESTIVAL:** It says "₹200 OFF on Full Grooming" but needs a minimum order of ₹1,699. Full Grooming is listed at ₹1,350. Which is correct?

Answer:

**6. Package details:** In **Full Grooming Package** and **Premium Package**, all included services are entered as one line, so the app counts them as one item. Can your team put each service on its own line in the admin panel, or should we?

Answer:

**7. Walking:** Which cities should offer dog walking at launch? Your service cities are Kanpur, Lucknow, Hyderabad, North Mumbai, South Mumbai, Navi Mumbai, Pune, Pimpri Chinchwad (Pune), Indore and Jaipur. (We switched walking on for Lucknow on the test site.)

Answer:

**8. Partner money:** The partner terms say you keep **20%** of each booking. Is that correct? How often are partners paid, and how? What is the most a freelancer may owe you before you take action?

Answer:

**9. Partner insurance:** The partner terms say "Wag & Tails provides basic job insurance." Do you provide this? If not, we will remove the sentence.

Answer:

**10. Claims shown to customers:** You have confirmed that partners are police verified. Is it also true that **every** partner is ID checked, background verified and **trained to handle anxious dogs**? Is service available **7 days a week**?

Answer:

**11. Refunds:** The app says you can cancel or reschedule free up to 3 hours before the slot. For later cancellations, or if nobody is available when the groomer arrives, there is no refund, but the visit is rescheduled once at no extra charge. If Wag & Tails cancels, the customer gets a full refund. Refunds take 5–7 business days. Is all of this correct?

Answer:

**12. Blood tests at home:** The app shows this as "Coming soon". Should it stay or be hidden at launch?

Answer:

**13. Pet insurance requests:** Who will follow up on quote requests from the app? Is there an insurer or any wording that must be shown?

Answer:

**14. Launch:** What is your target launch date, and who gives final approval?

Answer:

---

## Already confirmed (no action needed)

- Cats have the same prices as on your website.
- Support contact details match your website.
- Partners are police verified.
- The partner shop discount matches your website.
- The apps show the coupons that your website shows to customers.
- Free cancellation matches your website: up to 3 hours before the slot.
