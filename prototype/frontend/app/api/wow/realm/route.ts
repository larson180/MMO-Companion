import { NextResponse } from "next/server";

const BLIZZARD_REGION = "eu";
const LOCALE = "en_GB";

type BlizzardRealm = {
  id: number;
  name: string;
  slug: string;
};

type CachedRealms = {
  data: BlizzardRealm[];
  expiresAt: number;
};

let cache: CachedRealms | null = null;

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getBlizzardToken() {
  const clientId = process.env.BLIZZARD_CLIENT_ID;
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET"
    );
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `https://${BLIZZARD_REGION}.battle.net/oauth/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Blizzard OAuth failed (${response.status}): ${text}`
    );
  }

  const data = await response.json();

  return data.access_token as string;
}

export async function GET() {
  try {
    // Return cached realms if available.
    if (cache && cache.expiresAt > Date.now()) {
      return NextResponse.json({
        region: BLIZZARD_REGION,
        realms: cache.data,
      });
    }

    const token = await getBlizzardToken();

    const namespace = `dynamic-${BLIZZARD_REGION}`;

    const url =
      `https://${BLIZZARD_REGION}.api.blizzard.com/data/wow/realm/index` +
      `?namespace=${namespace}&locale=${LOCALE}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      const text = await response.text();

      return NextResponse.json(
        {
          error: `Blizzard realms request failed (${response.status})`,
          details: text,
        },
        {
          status: response.status,
        }
      );
    }

    const data = await response.json();

    const realms: BlizzardRealm[] = Array.isArray(data.realms)
      ? data.realms.map((realm: any) => ({
          id: Number(realm.id),
          name: String(realm.name),
          slug: String(realm.slug),
        }))
      : [];

    // Deduplicate by realm ID.
    const uniqueRealms = Array.from(
      new Map(realms.map((realm) => [realm.id, realm])).values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    cache = {
      data: uniqueRealms,
      expiresAt: Date.now() + CACHE_TTL,
    };

    return NextResponse.json({
      region: BLIZZARD_REGION,
      realms: uniqueRealms,
    });
  } catch (error) {
    console.error("REALMS API ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown Blizzard realms error",
      },
      { status: 500 }
    );
  }
}