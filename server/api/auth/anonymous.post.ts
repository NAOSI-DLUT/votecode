import { db, schema } from "@nuxthub/db";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

const alphabet = "abcdefghijklmnopqrstuvwxyz";

function createNickname(seed: string) {
  const hash = createHash("sha256").update(seed).digest();
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[hash[i]! % alphabet.length];
  }
  return `nick_${suffix}`;
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || "anonymous";
  const nickname = createNickname(ip);
  const avatarUrl = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${nickname}`;

  const inserted = await db
    .insert(schema.users)
    .values({
      id: nickname,
      name: nickname,
      avatar_url: avatarUrl,
    })
    .onConflictDoNothing()
    .returning();

  const user =
    inserted[0] ??
    (await db.query.users.findFirst({
      where: eq(schema.users.id, nickname),
    }));

  if (!user) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create anonymous user",
    });
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name,
      avatar_url: user.avatar_url,
    },
  });

  return { ok: true, user };
});
