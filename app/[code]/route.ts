
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "../lib/db";

// Helper to determine if a User-Agent is a bot/crawler
function detectBot(userAgent: string): boolean {
  if (!userAgent) return false;
  const botRegex = /bot|crawl|spider|slurp|crawler|google|baidu|bing|msn|duckduckbot|teoma|yandex|yahoo|whatsapp|telegram|discord|slack|curl|wget|postman|powershell/i;
  return botRegex.test(userAgent);
}

// Helper to parse User-Agent into OS, Browser, and Device Type
function parseUserAgent(userAgent: string) {
  const info = {
    device: "Desktop",
    browser: "Other",
    os: "Other",
  };

  if (!userAgent) return info;

  // Bot detection
  if (detectBot(userAgent)) {
    info.device = "Bot";
    info.browser = "Crawler";
    info.os = "Server";
    return info;
  }

  const ua = userAgent.toLowerCase();

  // Device type classification
  if (/mobi|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) {
      info.device = "Tablet";
    } else {
      info.device = "Mobile";
    }
  }

  // Simple OS parsing
  if (ua.includes("windows")) info.os = "Windows";
  else if (ua.includes("macintosh") || ua.includes("mac os")) info.os = "macOS";
  else if (ua.includes("android")) info.os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) info.os = "iOS";
  else if (ua.includes("linux")) info.os = "Linux";

  // Simple Browser parsing
  if (ua.includes("firefox")) info.browser = "Firefox";
  else if (ua.includes("chrome") && !ua.includes("chromium")) info.browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) info.browser = "Safari";
  else if (ua.includes("edge") || ua.includes("edg")) info.browser = "Edge";
  else if (ua.includes("opera") || ua.includes("opr")) info.browser = "Opera";

  return info;
}

function formatStatusDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`;
}

// Generate premium HTML response page
function renderStatusPage(title: string, heading: string, message: string, colorClass = "from-rose-500 to-amber-500") {
  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | FLCut</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body {
          background-color: #030712;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }
      </style>
    </head>
    <body class="flex flex-col items-center justify-center min-h-screen text-gray-100 px-6 overflow-hidden relative">
      <!-- Background glow -->
      <div class="absolute w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] -top-40 -left-20"></div>
      <div class="absolute w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] -bottom-40 -right-20"></div>

      <div class="z-10 w-full max-w-md bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 text-center shadow-2xl shadow-black/50">
        <!-- Logo -->
        <div class="flex justify-center mb-6">
          <div class="px-4 py-1.5 bg-gradient-to-r ${colorClass} rounded-full text-xs font-semibold tracking-wider text-black uppercase shadow-lg shadow-indigo-500/10">
            FLCut Event Link
          </div>
        </div>

        <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${colorClass} mb-4">
          ${heading}
        </h1>
        <p class="text-gray-400 text-base leading-relaxed mb-8">
          ${message}
        </p>

        <a href="https://finiteloop.club" target="_blank" rel="noopener noreferrer" 
           class="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 text-sm font-medium rounded-2xl transition-all duration-200 hover:-translate-y-0.5">
          Visit Finite Loop Club
        </a>
      </div>
    </body>
    </html>`,
    {
      headers: { "Content-Type": "text/html" },
    }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const cleanCode = code.trim().toLowerCase();

  try {
    // 1. Find the link by shortCode or alias
    const link = await db.link.findFirst({
      where: {
        OR: [{ shortCode: cleanCode }, { alias: cleanCode }],
      },
    });

    if (!link) {
      return renderStatusPage(
        "Link Not Found",
        "Link Not Found",
        "This FLCut link doesn't exist, or it has been deleted. Please double-check the URL or contact the organizer."
      );
    }

    // 2. Parse User Agent & request headers
    const userAgent = req.headers.get("user-agent") || "";
    const isBot = detectBot(userAgent);
    const { device, browser, os } = parseUserAgent(userAgent);

    // Try to extract real IP address
    const xForwardedFor = req.headers.get("x-forwarded-for");
    const ip = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "127.0.0.1";

    // Extract referrer
    const rawReferrer = req.headers.get("referer") || "";
    let referrer = "";
    
    // Check query parameters first for explicit source tracking (e.g., ?src=whatsapp)
    const urlObj = new URL(req.url);
    const trackingSrc = urlObj.searchParams.get("src") || urlObj.searchParams.get("ref") || urlObj.searchParams.get("source");
    
    if (trackingSrc) {
      const cleanSrc = trackingSrc.trim().toLowerCase();
      if (cleanSrc === "whatsapp" || cleanSrc === "wa") referrer = "WhatsApp";
      else if (cleanSrc === "instagram" || cleanSrc === "ig") referrer = "Instagram";
      else if (cleanSrc === "facebook" || cleanSrc === "fb") referrer = "Facebook";
      else if (cleanSrc === "linkedin" || cleanSrc === "li") referrer = "LinkedIn";
      else if (cleanSrc === "twitter" || cleanSrc === "x") referrer = "Twitter / X";
      else if (cleanSrc === "discord") referrer = "Discord";
      else referrer = trackingSrc.trim();
    } else if (rawReferrer) {
      try {
        const refUrl = new URL(rawReferrer);
        // Normalize referrer to host (e.g. instagram.com, t.co, facebook.com)
        referrer = refUrl.hostname.replace("www.", "");
      } catch {
        referrer = "Direct / Unknown";
      }
    } else {
      referrer = "Direct / Unknown";
    }

    // Fallback: Check User-Agent for specific in-app browser engines if referrer is Direct / Unknown
    if (referrer === "Direct / Unknown" && userAgent) {
      const ua = userAgent.toLowerCase();
      if (ua.includes("instagram")) {
        referrer = "Instagram (In-App)";
      } else if (ua.includes("whatsapp")) {
        referrer = "WhatsApp (In-App)";
      } else if (ua.includes("fban") || ua.includes("fbav")) {
        referrer = "Facebook (In-App)";
      } else if (ua.includes("linkedin")) {
        referrer = "LinkedIn (In-App)";
      } else if (ua.includes("twitter") || ua.includes("t.co")) {
        referrer = "Twitter / X (In-App)";
      }
    }

    // Extract location (Vercel provides geo headers)
    const country = req.headers.get("x-vercel-ip-country") || "";
    const region = req.headers.get("x-vercel-ip-country-region") || "";
    const location = country ? (region ? `${region}, ${country}` : country) : "Local / Unknown";

    // 3. Constraints Checking
    const now = new Date();

    // Check Go-Live scheduling
    if (link.goLiveAt && now < new Date(link.goLiveAt)) {
      const formattedDate = formatStatusDateTime(new Date(link.goLiveAt));
      return renderStatusPage(
        "Upcoming Event",
        "Not Yet Active",
        `This link is scheduled to go live on <strong class="text-white">${formattedDate}</strong>. Please check back then!`,
        "from-indigo-400 to-cyan-400"
      );
    }

    // Check Expiry scheduling
    if (link.expiresAt && now > new Date(link.expiresAt)) {
      return renderStatusPage(
        "Link Expired",
        "Link Expired",
        "This event registration link has expired. The event or signup deadline has passed.",
        "from-gray-500 to-gray-700"
      );
    }

    // Check click capacity limit (only counts human clicks, bots are exempted from the cap)
    if (link.clickLimit && !isBot) {
      const humanClickCount = await db.click.count({
        where: {
          linkId: link.id,
          device: { not: "Bot" },
        },
      });

      if (humanClickCount >= link.clickLimit) {
        return renderStatusPage(
          "Registration Full",
          "Capacity Reached",
          "All registrations for this event are currently full. This link has reached its maximum visitor limit.",
          "from-rose-500 to-orange-500"
        );
      }
    }

    // 4. Log the click and redirect
    await logClick({
      linkId: link.id,
      ip,
      userAgent,
      device,
      browser,
      os,
      referrer,
      location,
    });

    return NextResponse.redirect(link.url, 307);
  } catch (error) {
    console.error("Redirection engine error:", error);
    return renderStatusPage(
      "Error",
      "System Error",
      "We encountered an issue processing this request. Please try again later."
    );
  }
}

// Log click event, verifying uniqueness (hashed IP + UA within 24h)
async function logClick(data: {
  linkId: string;
  ip: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  referrer: string;
  location: string;
}) {
  try {
    // Generate SHA-256 hash of IP + UserAgent for privacy-centric uniqueness detection
    const hashInput = `${data.ip}|${data.userAgent}`;
    const hash = createHash("sha256").update(hashInput).digest("hex");

    // Check if there was a click from this visitor (hash) for this link in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingRecentClick = await db.click.findFirst({
      where: {
        linkId: data.linkId,
        hash,
        timestamp: { gte: oneDayAgo },
      },
    });

    const isUnique = !existingRecentClick;

    // Create the Click record
    await db.click.create({
      data: {
        linkId: data.linkId,
        isUnique,
        hash,
        userAgent: data.userAgent,
        device: data.device,
        browser: data.browser,
        os: data.os,
        referrer: data.referrer,
        location: data.location,
      },
    });
  } catch (err) {
    console.error("Failed to save click to database:", err);
  }
}
