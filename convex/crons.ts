// Cron registry. Kept minimal: we only run scheduled work when a form
// opts in to it. The auto-close sweep is a no-op for guilds that never
// turn on ticket mode, so the hourly wake-up cost is negligible.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep ticket-mode submissions whose lastActivityAt is older than the
// form's `autoCloseInactiveDays` window and mark them `closed`. Running
// hourly balances snappy-enough auto-close with low load; the mutation
// itself is budgeted to 50 rows per run so a backlog never blows the
// transaction wall.
crons.interval(
  "auto-close inactive tickets",
  { hours: 1 },
  internal.submissions.sweepAutoCloseTickets,
  {},
);

export default crons;
