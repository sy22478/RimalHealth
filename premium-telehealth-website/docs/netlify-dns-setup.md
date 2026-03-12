# Setting Up Netlify DNS on SiteGround for rimalhealth.com

This guide walks you through pointing your SiteGround-registered domain `rimalhealth.com` to your Netlify deployment.

There are two approaches. **Option A (recommended)** is simpler and gives Netlify full DNS control (including automatic SSL). **Option B** keeps DNS at SiteGround if you have other services (email, subdomains) that must stay there.

---

## Prerequisites

Before starting:
1. Your site is already deployed on Netlify and working at its `*.netlify.app` subdomain
2. You have access to your SiteGround Site Tools or cPanel
3. You have access to your Netlify dashboard

---

## Step 1: Add Your Custom Domain in Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com) → select your site
2. Go to **Domain management** (or **Site configuration → Domain management**)
3. Click **Add a domain**
4. Enter `rimalhealth.com` and click **Verify**
5. Netlify will show that you don't own the DNS — click **Add domain** to confirm
6. Netlify will automatically add both:
   - `rimalhealth.com` (apex/root domain)
   - `www.rimalhealth.com` (www subdomain)

> Note the Netlify load balancer IP address shown — typically something like `75.2.60.5` (an Anycast IP). You'll need this for Option B. You can find it under **Domain management → DNS records** or by checking the instructions Netlify shows.

---

## Option A: Use Netlify DNS (Recommended)

This transfers DNS control entirely to Netlify. Best if `rimalhealth.com` is only used for this site.

### Step A1: Set Up Netlify DNS Zone

1. In Netlify → **Domain management** → next to your domain, click **Options → Set up Netlify DNS**
2. Netlify will create a DNS zone and show you **nameservers**, typically:
   ```
   dns1.p06.nsone.net
   dns2.p06.nsone.net
   dns3.p06.nsone.net
   dns4.p06.nsone.net
   ```
   (Your actual nameservers will vary — copy the exact ones Netlify shows you.)

### Step A2: Update Nameservers on SiteGround

1. Log in to [SiteGround](https://my.siteground.com)
2. Go to **Services → Domains** (or **My Accounts → Domains** depending on your dashboard)
3. Find `rimalhealth.com` and click **Manage**
4. Look for **Nameservers** or **DNS Settings** section
5. Click **Change nameservers** (or similar)
6. Switch from SiteGround's default nameservers to **custom nameservers**
7. Enter the 4 Netlify nameservers from Step A1:
   ```
   dns1.p06.nsone.net
   dns2.p06.nsone.net
   dns3.p06.nsone.net
   dns4.p06.nsone.net
   ```
8. Save changes

### Step A3: Wait for Propagation

- DNS propagation takes **15 minutes to 48 hours** (typically 1–4 hours)
- Check progress at [whatsmydns.net](https://www.whatsmydns.net/) — search for `rimalhealth.com` with record type `NS`
- Once propagated, the NS records should show Netlify's nameservers

### Step A4: Verify and Enable HTTPS

1. Back in Netlify → **Domain management**, your domain should show as verified (green checkmark)
2. Go to **HTTPS** section → click **Verify DNS configuration**
3. Once verified, click **Provision certificate** — Netlify auto-provisions a free Let's Encrypt SSL cert
4. Enable **Force HTTPS** to redirect all HTTP traffic to HTTPS

### Step A5: Set Up Email DNS (If Needed)

If you use SiteGround for email (e.g., `info@rimalhealth.com`), you must re-add email DNS records in Netlify's DNS panel:

1. In Netlify → **DNS settings** for your domain
2. Add the MX records that SiteGround provided for your email:
   ```
   MX  @  mx1.siteground.biz  priority 10
   MX  @  mx2.siteground.biz  priority 20
   ```
   (Check your SiteGround email settings for the exact MX values — they may differ.)
3. If SiteGround email requires SPF/DKIM/DMARC records, add those as TXT records too

---

## Option B: Keep DNS at SiteGround (Add Records Manually)

Use this if you have email, subdomains, or other services on SiteGround that you don't want to disrupt.

### Step B1: Find the Netlify IP / CNAME Target

In Netlify → **Domain management**, note:
- For the **apex domain** (`rimalhealth.com`): Netlify's load balancer IP (e.g., `75.2.60.5`)
- For **www**: the CNAME target — your Netlify subdomain (e.g., `your-site-name.netlify.app`)

### Step B2: Update DNS Records on SiteGround

1. Log in to [SiteGround](https://my.siteground.com)
2. Go to **Websites → Site Tools** for your domain
3. Navigate to **Domain → DNS Zone Editor**
4. **Delete or edit** the existing A record for `rimalhealth.com` that points to SiteGround's server
5. **Add a new A record** for the apex domain:
   ```
   Type: A
   Name: @ (or leave blank — means rimalhealth.com)
   Value: 75.2.60.5  (use the IP Netlify shows you)
   TTL: 3600 (or lowest available)
   ```
6. **Add (or update) a CNAME record** for www:
   ```
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app
   TTL: 3600
   ```
7. Save changes

> **Important:** If SiteGround has a "hosting" or "parking" A record that conflicts, you must remove/replace it. Some SiteGround plans auto-create A records — make sure only the Netlify-pointing A record exists.

### Step B3: Wait for Propagation

- Same as Option A — typically 1–4 hours
- Check at [whatsmydns.net](https://www.whatsmydns.net/) → search `rimalhealth.com` with record type `A`
- The result should show Netlify's IP address, not SiteGround's

### Step B4: Verify and Enable HTTPS in Netlify

1. In Netlify → **Domain management**, check that the domain shows as verified
2. If it says "Awaiting External DNS" — wait for propagation, then click **Verify DNS configuration**
3. Once verified, go to **HTTPS** → **Provision certificate**
4. Enable **Force HTTPS**

---

## Verification Checklist

After setup, confirm everything works:

- [ ] `http://rimalhealth.com` → redirects to `https://rimalhealth.com` → shows your Netlify site
- [ ] `http://www.rimalhealth.com` → redirects to `https://rimalhealth.com` (or `https://www.rimalhealth.com`, depending on your Netlify primary domain setting)
- [ ] HTTPS padlock shows valid certificate (Let's Encrypt via Netlify)
- [ ] Netlify domain management shows green checkmarks for both `rimalhealth.com` and `www.rimalhealth.com`
- [ ] If using email: send a test email to/from your `@rimalhealth.com` address to confirm MX records work

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Domain still shows old SiteGround site | DNS hasn't propagated yet — wait up to 48h. Clear browser cache or try incognito. |
| Netlify says "DNS verification failed" | Your DNS records haven't propagated. Wait, then click "Verify" again. |
| HTTPS certificate won't provision | DNS must be fully pointing to Netlify first. Check that A/CNAME records are correct. Netlify retries automatically. |
| Email stopped working (Option A) | You need to re-add MX, SPF, DKIM, and DMARC records in Netlify's DNS panel. |
| "Too many redirects" error | Check that you don't have conflicting redirect rules. In Netlify, ensure **Force HTTPS** is on and no `_redirects` file creates a loop. |
| Site shows but API calls fail | Make sure `NEXT_PUBLIC_APP_URL` env var in Netlify is set to `https://rimalhealth.com` |
