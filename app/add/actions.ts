"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { ingestPair, sendOnDates } from "@/lib/pipeline";

export async function addPerson(formData: FormData): Promise<{ error: string } | void> {
  if (process.env.LIVE_SITE_URL) return { error: "This is the read-only demo. Add people on the live site." };
  let slug: string;
  try {
    const result = await ingestPair(String(formData.get("linkedin") ?? ""), String(formData.get("instagram") ?? ""), {
      dates: false,
    });
    slug = result.slug;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Those pages could not be read." };
  }
  after(async () => {
    await sendOnDates(slug);
  });
  redirect(`/people/${slug}?notice=${encodeURIComponent("Read. The agent is on dates now. Refresh in a few minutes.")}`);
}
