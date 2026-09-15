import type { Metadata } from "next";
import { getChurchConfig } from "../../../../lib/config";
import { isEmailConfigured } from "../../../../lib/email";
import { complianceFooter } from "../../../../lib/keywords";
import { isMediaConfigured } from "../../../../lib/media";
import { groupReachCounts, listGroups } from "../../../../lib/members";
import { isTwilioConfigured } from "../../../../lib/twilio";
import { Composer, type GroupOption } from "./composer";

export const metadata: Metadata = { title: "Compose" };
export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const church = getChurchConfig();
  const [groups, smsCounts, emailCounts] = await Promise.all([
    listGroups(),
    groupReachCounts("sms"),
    groupReachCounts("email"),
  ]);

  const options: GroupOption[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    smsCount: smsCounts.get(group.id) ?? 0,
    emailCount: emailCounts.get(group.id) ?? 0,
  }));

  return (
    <>
      <h1>Compose</h1>
      <p className="admin-lede">
        Write once, see what it costs, then send. The price updates as you type.
      </p>

      <Composer
        groups={options}
        footerText={complianceFooter(church.shortName)}
        smsReady={isTwilioConfigured()}
        emailReady={isEmailConfigured()}
        mediaReady={isMediaConfigured()}
      />
    </>
  );
}
