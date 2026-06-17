
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../lib/db";

// Reserved slugs that cannot be used as custom aliases to prevent route conflicts
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "dashboard",
  "links",
  "analytics",
  "static",
  "favicon.ico",
  "_next",
  "public",
  "stats",
  "waitlist",
  "expired",
  "pending",
]);

// Base58 characters (omits 0, O, I, l to prevent visual confusion)
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function generateRandomCode(length = 6): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * BASE58_ALPHABET.length);
    result += BASE58_ALPHABET[randomIndex];
  }
  return result;
}

// Helper to verify passcode from request headers
function verifyPasscode(req: NextRequest): boolean {
  const serverPasscode = process.env.CREATION_PASSCODE || "FLC2026";
  const clientPasscode = req.headers.get("x-flcut-passcode");
  return clientPasscode === serverPasscode;
}

// GET: Fetch all links (shared team view)
export async function GET(req: NextRequest) {
  if (!verifyPasscode(req)) {
    return NextResponse.json({ error: "Unauthorized. Invalid passcode." }, { status: 401 });
  }

  try {
    const links = await db.link.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { clicks: true },
        },
      },
    });

    // Format output to include total clicks easily
    const formattedLinks = links.map((link) => ({
      ...link,
      clickCount: link._count.clicks,
    }));

    return NextResponse.json(formattedLinks);
  } catch (error) {
    console.error("Failed to fetch links:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new short link
export async function POST(req: NextRequest) {
  if (!verifyPasscode(req)) {
    return NextResponse.json({ error: "Unauthorized. Invalid passcode." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { url, alias, goLiveAt, expiresAt, clickLimit } = body;

    // Validate original URL
    if (!url) {
      return NextResponse.json({ error: "Destination URL is required." }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid destination URL format." }, { status: 400 });
    }

    let shortCode = "";

    if (alias) {
      const cleanAlias = alias.trim().toLowerCase();

      // Check validation constraints
      if (cleanAlias.length < 3) {
        return NextResponse.json({ error: "Alias must be at least 3 characters long." }, { status: 400 });
      }

      if (!/^[a-z0-9-_]+$/.test(cleanAlias)) {
        return NextResponse.json({ error: "Alias can only contain letters, numbers, hyphens, and underscores." }, { status: 400 });
      }

      if (RESERVED_SLUGS.has(cleanAlias)) {
        return NextResponse.json({ error: `The alias "${cleanAlias}" is reserved for system use.` }, { status: 400 });
      }

      // Check collision
      const existing = await db.link.findFirst({
        where: {
          OR: [{ shortCode: cleanAlias }, { alias: cleanAlias }],
        },
      });

      if (existing) {
        return NextResponse.json({ error: `The alias "${cleanAlias}" is already taken.` }, { status: 400 });
      }

      shortCode = cleanAlias;
    } else {
      // Generate unique short code with collision protection
      let attempts = 0;
      const maxAttempts = 5;
      while (attempts < maxAttempts) {
        const candidate = generateRandomCode(6);
        const existing = await db.link.findFirst({
          where: {
            OR: [{ shortCode: candidate }, { alias: candidate }],
          },
        });
        if (!existing) {
          shortCode = candidate;
          break;
        }
        attempts++;
      }

      if (!shortCode) {
        return NextResponse.json({ error: "Failed to generate a unique short link. Please try again." }, { status: 500 });
      }
    }

    // Create the Link record
    const newLink = await db.link.create({
      data: {
        url,
        shortCode,
        alias: alias ? alias.trim().toLowerCase() : null,
        goLiveAt: goLiveAt ? new Date(goLiveAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        clickLimit: clickLimit ? parseInt(clickLimit, 10) : null,
      },
    });

    return NextResponse.json(newLink, { status: 201 });
  } catch (error) {
    console.error("Failed to create link:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Delete an existing link
export async function DELETE(req: NextRequest) {
  if (!verifyPasscode(req)) {
    return NextResponse.json({ error: "Unauthorized. Invalid passcode." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Link ID is required." }, { status: 400 });
  }

  try {
    // Delete the link (Cascade deletes clicks automatically)
    await db.link.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete link:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
