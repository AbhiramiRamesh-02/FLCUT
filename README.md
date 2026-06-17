# FLCut — URL Shortener for Finite Loop Club

Passcode:** `FLC2026`

FLCut is a simple URL shortener built for Finite Loop Club events. It helps organizers create, manage, and track short links for registrations, resources, feedback forms, and community invites.

---

## Tech & Database Design

I used PostgreSQL and Prisma with two main tables:

### Link

Stores:

* Original URL
* Short code or custom alias
* Start and end dates
* Click limit

### Click

Stores:

* Visitor hash
* Device type
* Country
* Click details

### Why this Design?

* **Fast Redirects:** Each short code is unique, making redirects quick and efficient.
* **Privacy-Friendly:** Instead of storing actual IP addresses, the system stores a SHA-256 hash generated from the visitor's IP address and User-Agent.

A visitor is counted as unique if they have not opened the same link within the last 24 hours.

---

## What I Would Build in 4 Hours

### First Priority

* Database schema
* URL shortening logic
* Redirect functionality
* Link creation form

### Features I Would Leave for Later

* Advanced analytics charts
* Detailed tracking reports
* Complex scheduling features
* Click limit handling
* Custom UI styling

The focus would be to build a working and reliable URL shortener before adding extra features.

---

## Trade-Offs

### Shared Passcode vs User Accounts

I chose a shared passcode instead of individual user accounts.

**Benefits**

* Quick and easy access for organizers
* No sign-up process
* No password management





---

## Assumptions

* Organizers would prefer a simple shared passcode over creating and managing individual accounts.
* Event links are mainly shared through WhatsApp, Instagram, QR codes, posters, and direct links.
* Organizers would find it useful to have one-click sharing options for WhatsApp and Instagram.
* Different events need different share messages, so pre-made templates for registrations, resources, feedback forms, and community invites would save time.
* Organizers would want to know where their traffic is coming from, such as WhatsApp, Instagram, QR code scans, or direct visits.
* Links should be easy to delete when they are no longer needed.
* Users should see a clear message if a link is not yet active or has expired.
* A 12-hour AM/PM format would be easier for organizers than a 24-hour clock.
* Developers would benefit from a quick "Test Link" button to verify redirects.
* If a registration limit is reached, users should see a friendly **"Registrations Full"** message instead of an error page.
* Bot traffic from services like WhatsApp, Discord, Slack, and other link-preview crawlers should not count toward click limits or analytics.
