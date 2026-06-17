
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";

// Helper to verify passcode from request headers
function verifyPasscode(req: NextRequest): boolean {
  const serverPasscode = process.env.CREATION_PASSCODE || "FLC2026";
  const clientPasscode = req.headers.get("x-flcut-passcode");
  return clientPasscode === serverPasscode;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!verifyPasscode(req)) {
    return NextResponse.json({ error: "Unauthorized. Invalid passcode." }, { status: 401 });
  }

  const { code } = await params;

  try {
    const link = await db.link.findFirst({
      where: {
        OR: [{ shortCode: code }, { alias: code }],
      },
      include: {
        clicks: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found." }, { status: 404 });
    }

    // Split clicks into bot vs non-bot
    const allClicks = link.clicks;
    const botClicks = allClicks.filter((c) => c.device === "Bot");
    const humanClicks = allClicks.filter((c) => c.device !== "Bot");

    const totalClicks = humanClicks.length;
    const uniqueClicks = humanClicks.filter((c) => c.isUnique).length;
    const totalBotClicks = botClicks.length;

    // Referrers breakdown (Human clicks only)
    const referrers: Record<string, number> = {};
    // Devices breakdown (Human clicks only)
    const devices: Record<string, number> = {};
    // Locations breakdown (Human clicks only)
    const locations: Record<string, number> = {};

    humanClicks.forEach((click) => {
      // Referrer
      const ref = click.referrer || "Direct / Unknown";
      referrers[ref] = (referrers[ref] || 0) + 1;

      // Device
      const dev = click.device || "Unknown";
      devices[dev] = (devices[dev] || 0) + 1;

      // Location
      const loc = click.location || "Unknown";
      locations[loc] = (locations[loc] || 0) + 1;
    });

    // Time-series breakdown (group clicks by date-hour: YYYY-MM-DD HH:00)
    // We group by hour to show interactive spikes.
    const timeSeriesMap: Record<string, { total: number; unique: number }> = {};

    humanClicks.forEach((click) => {
      const date = new Date(click.timestamp);
      // Format as YYYY-MM-DD HH:00
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const key = `${year}-${month}-${day} ${hour}:00`;

      if (!timeSeriesMap[key]) {
        timeSeriesMap[key] = { total: 0, unique: 0 };
      }
      timeSeriesMap[key].total += 1;
      if (click.isUnique) {
        timeSeriesMap[key].unique += 1;
      }
    });

    const timeSeries = Object.entries(timeSeriesMap).map(([time, data]) => ({
      time,
      clicks: data.total,
      uniqueClicks: data.unique,
    }));

    return NextResponse.json({
      link: {
        id: link.id,
        url: link.url,
        shortCode: link.shortCode,
        alias: link.alias,
        createdAt: link.createdAt,
        goLiveAt: link.goLiveAt,
        expiresAt: link.expiresAt,
        clickLimit: link.clickLimit,
      },
      stats: {
        totalClicks,
        uniqueClicks,
        botClicks: totalBotClicks,
        referrers: Object.entries(referrers).map(([name, count]) => ({ name, count })),
        devices: Object.entries(devices).map(([name, count]) => ({ name, count })),
        locations: Object.entries(locations).map(([name, count]) => ({ name, count })),
        timeSeries,
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
