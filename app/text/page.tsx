import type { Metadata } from "next";
import { getChurchConfig } from "../../lib/config";
import { listSelfServeGroups } from "../../lib/members";
import "../admin/admin.css";
import { SignupForm, type SelfServeGroup } from "./signup-form";

export const metadata: Metadata = {
  title: "Get text updates",
  description:
    "Sign up to receive text message updates from Beulah Baptist Church.",
};

// Group options come from the database on each request.
export const dynamic = "force-dynamic";

export default async function TextSignup() {
  const church = getChurchConfig();
  const groups = await loadGroups();

  return (
    <main>
      <section className="hero interior-hero">
        <div className="hero-content wrap">
          <p className="breadcrumbs">Home / Text updates</p>
          <h1>
            Never miss
            <br />a word.
          </h1>
        </div>
      </section>

      <section className="section wrap">
        <SignupForm groups={groups} churchName={church.name} />

        <p
          style={{
            maxWidth: 560,
            margin: "26px auto 0",
            fontSize: "0.78rem",
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          We never sell or share your number. Texts come from the church office
          only. Reply STOP at any time to stop receiving them, or call{" "}
          <a href={`tel:${church.helpContact.replace(/\D/g, "")}`}>
            {church.helpContact}
          </a>
          .
        </p>
      </section>
    </main>
  );
}

/**
 * A brand-new deploy has no database yet. The page should still render, just
 * without the optional group picker, rather than 500 on a visitor.
 */
async function loadGroups(): Promise<SelfServeGroup[]> {
  try {
    const rows = await listSelfServeGroups();
    return rows.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
    }));
  } catch (error) {
    console.error("[text] could not load groups", error);
    return [];
  }
}
