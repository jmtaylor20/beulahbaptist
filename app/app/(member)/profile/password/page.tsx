import { requireMember } from "../../../../../lib/members";
import { Notice } from "../../../ui";
import { updatePassword } from "../../../(auth)/actions";

export const metadata = { title: "Change password" };

export default async function Password({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireMember();
  const sp = await searchParams;
  return (
    <>
      <h1>Change password</h1>
      <Notice searchParams={sp} />
      <form className="ma-form ma-card" action={updatePassword}>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /><span className="hint">At least 8 characters.</span></label>
        <button className="button navy" type="submit">Update password</button>
      </form>
    </>
  );
}
