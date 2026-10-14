// Fall Bingo fundraiser comes down Oct 17, 2026 at 6:00 PM Central (Dadeville, AL).
export const FALL_BINGO_ENDS = Date.parse("2026-10-17T18:00:00-05:00");
export const fallBingoIsActive = () => Date.now() < FALL_BINGO_ENDS;
