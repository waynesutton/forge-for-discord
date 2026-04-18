import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { verifyKey } from "discord-interactions";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

// 1. Robel Convex Auth: OAuth start/callback + JWKS endpoints.
auth.http.add(http);

type DiscordCommandInteraction = {
  type: 2;
  guild_id?: string;
  member?: {
    roles?: Array<string>;
  };
  data?: {
    name?: string;
  };
};

// Modal submit payloads ship every value nested under a root component
// list. Depending on the modal shape the inner leaf is either a TEXT_INPUT
// (value is a string) or a STRING_SELECT (values is an array). Labels wrap
// an inner `component` object, while classic action rows use `components`.
type DiscordModalComponentNode = {
  type?: number;
  custom_id?: string;
  value?: string;
  values?: Array<string>;
  component?: DiscordModalComponentNode;
  components?: Array<DiscordModalComponentNode>;
};

type DiscordModalSubmitInteraction = {
  type: 5;
  data?: {
    custom_id?: string;
    components?: Array<DiscordModalComponentNode>;
  };
  guild_id?: string;
  member?: {
    roles?: Array<string>;
    user?: {
      id?: string;
      username?: string;
      global_name?: string | null;
    };
  };
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
  };
};

type DiscordComponentInteraction = {
  type: 3;
  data?: {
    custom_id?: string;
    component_type?: number;
  };
  guild_id?: string;
  member?: {
    roles?: Array<string>;
    // Discord sends the member's resolved permission bitfield as a
    // stringified bigint. We only check the Administrator bit (0x8) so a
    // server admin always passes the ticket gate even without a mod role.
    permissions?: string;
    user?: {
      id?: string;
      username?: string;
      global_name?: string | null;
    };
  };
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
  };
};

type DiscordPingInteraction = {
  type: 1;
};

type DiscordInteraction =
  | DiscordPingInteraction
  | DiscordCommandInteraction
  | DiscordComponentInteraction
  | DiscordModalSubmitInteraction;

// 2. Discord interactions. Verifies Ed25519 signature, responds to PING, and
// now handles the first publish path: registered slash commands open a modal
// from the saved form fields, then modal submits are written to `submissions`.
http.route({
  path: "/interactions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const rawBody = await request.text();
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
      return new Response("Bad request", { status: 401 });
    }

    const isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody) as DiscordInteraction;
    // PING
    if (payload.type === 1) {
      return Response.json({ type: 1 });
    }

    if (payload.type === 2) {
      const commandName = payload.data?.name;
      const discordGuildId = payload.guild_id;
      if (!commandName || !discordGuildId) {
        return ephemeralResponse("Forge commands only work inside a Discord server.");
      }

      const form = await ctx.runQuery(internal.forms.getByCommand, {
        discordGuildId,
        commandName,
      });
      if (!form || !form.published) {
        return ephemeralResponse("This form is not published yet.");
      }
      if (form.fields.length === 0) {
        return ephemeralResponse("This form needs at least one field before it can open.");
      }
      const memberRoles = payload.member?.roles ?? [];
      if (
        form.requiredRoleIds &&
        !hasAllRoles(memberRoles, form.requiredRoleIds)
      ) {
        return ephemeralResponse(
          "You do not have the required roles to use this form.",
        );
      }
      if (
        form.restrictedRoleIds &&
        hasAnyRole(memberRoles, form.restrictedRoleIds)
      ) {
        return ephemeralResponse(
          "You are blocked from using this form based on your current roles.",
        );
      }

      return Response.json({
        type: 9,
        data: {
          custom_id: `form:${form._id}`,
          title: form.title.slice(0, 45),
          components: buildModalComponents(form.fields),
        },
      });
    }

    // MESSAGE_COMPONENT (button/select click). Phase 3 routes two custom id
    // prefixes: `approve:<submissionId>` records approval inline, and
    // `deny:<submissionId>` opens the reason modal. Anything else is an old
    // component from a now-unsupported flow, so we 410-style ephemeral.
    if (payload.type === 3) {
      const customId = payload.data?.custom_id ?? "";

      // Ticket lifecycle buttons (claim/unclaim/resolve/reopen/close).
      // Handled before the approve/deny parse so the `ticket:` prefix is
      // not misread as a submission id.
      if (customId.startsWith("ticket:")) {
        return await handleTicketButton(ctx, customId, payload);
      }

      const submissionIdFromClick = parseSubmissionIdFromCustomId(customId);
      if (!submissionIdFromClick) {
        return ephemeralResponse("This button is no longer supported.");
      }

      const moderatorId =
        payload.member?.user?.id ?? payload.user?.id ?? undefined;
      const moderatorName =
        payload.member?.user?.global_name ??
        payload.member?.user?.username ??
        payload.user?.global_name ??
        payload.user?.username ??
        undefined;
      if (!moderatorId || !moderatorName) {
        return ephemeralResponse("Forge could not identify the moderator.");
      }

      const context = await ctx.runQuery(internal.submissions.routeContext, {
        submissionId: submissionIdFromClick,
      });
      if (!context) {
        return ephemeralResponse("This submission is no longer available.");
      }

      // Fail closed. If the form has mod roles configured, the caller must
      // carry one. If no mod roles are configured, we fall back to Discord's
      // Administrator bit so server admins still moderate, but anyone else is
      // rejected (previous behavior was "anyone can approve/deny when
      // modRoleIds is empty", flagged by the 2026-04-18 audit).
      const modRoles = context.form.modRoleIds ?? [];
      const memberRoles = payload.member?.roles ?? [];
      const isServerAdmin = hasAdministratorPermission(
        payload.member?.permissions,
      );
      if (modRoles.length > 0) {
        if (!hasAnyRole(memberRoles, modRoles) && !isServerAdmin) {
          return ephemeralResponse(
            "You do not have a mod role configured for this form.",
          );
        }
      } else if (!isServerAdmin) {
        return ephemeralResponse(
          "Only server admins can moderate this form. Add a mod role on the form to open moderation to others.",
        );
      }

      if (
        context.submission.status === "approved" ||
        context.submission.status === "denied"
      ) {
        return ephemeralResponse(
          `Already handled${
            context.submission.decidedBy ? ` by ${context.submission.decidedBy}` : ""
          }.`,
        );
      }

      if (customId.startsWith("approve:")) {
        await ctx.runMutation(internal.submissions.recordDecision, {
          submissionId: submissionIdFromClick,
          decision: "approved",
          moderatorId,
          moderatorName,
        });
        return ephemeralResponse("Approval recorded.");
      }

      if (customId.startsWith("deny:")) {
        return Response.json({
          type: 9,
          data: {
            custom_id: `deny:${submissionIdFromClick}`,
            title: "Deny submission",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 4,
                    custom_id: "reason",
                    label: "Reason (shared with submitter)",
                    style: 2,
                    required: false,
                    max_length: 500,
                    placeholder: "Short note on why this is denied.",
                  },
                ],
              },
            ],
          },
        });
      }

      return ephemeralResponse("This action is not supported.");
    }

    if (payload.type === 5) {
      const customId = payload.data?.custom_id;

      // Deny reason modal submit. `deny:<submissionId>` was set when the
      // reviewer clicked the red button. Record the decision inline; the
      // embed edit, submitter DM, and audit row all run via scheduler.
      if (customId?.startsWith("deny:")) {
        const submissionIdRaw = customId.slice("deny:".length) as Id<"submissions">;

        const moderatorId =
          payload.member?.user?.id ?? payload.user?.id ?? undefined;
        const moderatorName =
          payload.member?.user?.global_name ??
          payload.member?.user?.username ??
          payload.user?.global_name ??
          payload.user?.username ??
          undefined;
        if (!moderatorId || !moderatorName) {
          return ephemeralResponse("Forge could not identify the moderator.");
        }

        const denyContext = await ctx.runQuery(
          internal.submissions.routeContext,
          { submissionId: submissionIdRaw },
        );
        if (!denyContext) {
          return ephemeralResponse("This submission is no longer available.");
        }
        const denyModRoles = denyContext.form.modRoleIds ?? [];
        const denyMemberRoles = payload.member?.roles ?? [];
        if (
          denyModRoles.length > 0 &&
          !hasAnyRole(denyMemberRoles, denyModRoles)
        ) {
          return ephemeralResponse(
            "You do not have a mod role configured for this form.",
          );
        }
        if (
          denyContext.submission.status === "approved" ||
          denyContext.submission.status === "denied"
        ) {
          return ephemeralResponse(
            `Already handled${
              denyContext.submission.decidedBy
                ? ` by ${denyContext.submission.decidedBy}`
                : ""
            }.`,
          );
        }

        const reason = collectModalValues(payload).reason?.trim();
        await ctx.runMutation(internal.submissions.recordDecision, {
          submissionId: submissionIdRaw,
          decision: "denied",
          moderatorId,
          moderatorName,
          denyReason: reason && reason.length > 0 ? reason : undefined,
        });

        return ephemeralResponse("Denial recorded.");
      }

      if (!customId?.startsWith("form:")) {
        return ephemeralResponse("Forge could not match that modal to a saved form.");
      }

      const rawFormId = customId.slice("form:".length);
      let form = null;
      try {
        form = await ctx.runQuery(internal.forms.getForModalSubmit, {
          formId: rawFormId as Id<"forms">,
        });
      } catch {
        return ephemeralResponse("Forge could not load that form.");
      }

      if (!form || !form.published) {
        return ephemeralResponse("This form is not published anymore.");
      }
      const modalMemberRoles = payload.member?.roles ?? [];
      if (
        form.requiredRoleIds &&
        !hasAllRoles(modalMemberRoles, form.requiredRoleIds)
      ) {
        return ephemeralResponse(
          "You do not have the required roles to submit this form.",
        );
      }
      if (
        form.restrictedRoleIds &&
        hasAnyRole(modalMemberRoles, form.restrictedRoleIds)
      ) {
        return ephemeralResponse(
          "You are blocked from submitting this form based on your current roles.",
        );
      }

      const submitterId = payload.member?.user?.id ?? payload.user?.id;
      const submitterName =
        payload.member?.user?.global_name ??
        payload.member?.user?.username ??
        payload.user?.global_name ??
        payload.user?.username;
      if (!submitterId || !submitterName) {
        return ephemeralResponse("Forge could not identify the submitting user.");
      }

      const values = collectModalValues(payload);
      let submitResult;
      try {
        submitResult = await ctx.runMutation(internal.submissions.insertFromDiscord, {
          guildId: form.guildId,
          formId: form._id,
          submitterId,
          submitterName,
          values,
          status: form.requiresApproval ? "pending" : "auto_published",
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("submission_limit_reached")
        ) {
          return ephemeralResponse(
            "You already reached the maximum number of submissions for this form.",
          );
        }
        if (
          error instanceof Error &&
          error.message.includes("daily_submission_limit_reached")
        ) {
          return ephemeralResponse(
            "You already reached today's submission limit for this form.",
          );
        }
        throw error;
      }

      return ephemeralResponse(
        submitResult.successMessage ??
          (form.requiresApproval
            ? "Submission received. It is now waiting for review."
            : "Submission received."),
      );
    }

    return new Response("Not implemented", { status: 501 });
  }),
});

// 3. Discord bot install OAuth callback. Flow:
//    (a) Admin clicks Connect in /app/settings → actions.discord.generateInstallUrl
//        returns a URL with `state=<nonce>` baked in.
//    (b) Admin authorizes on discord.com → Discord 302s here with
//        `?code=<x>&guild_id=<g>&state=<nonce>`.
//    (c) We consume the nonce to recover the admin's Forge user id (the
//        OAuth redirect is cross-domain so `ctx.auth` would be empty).
//    (d) Exchange the code for a guild payload, register the guilds row,
//        and bounce the admin back to /app/settings with ?installed=<id>
//        so the UI can confirm success.
//
// On any failure we redirect to /app/settings?error=<code> rather than
// returning 500 so the admin always lands somewhere useful.
http.route({
  path: "/api/discord/install",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const appUrl = process.env.APP_URL ?? url.origin;

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return Response.redirect(
        `${appUrl}/app/settings?error=${encodeURIComponent(error)}`,
        302,
      );
    }
    if (!code || !state) {
      return Response.redirect(
        `${appUrl}/app/settings?error=missing_params`,
        302,
      );
    }

    const nonce = await ctx.runMutation(internal.oauthStates.consume, {
      state,
      kind: "discord_install",
    });
    if (!nonce) {
      return Response.redirect(
        `${appUrl}/app/settings?error=invalid_state`,
        302,
      );
    }

    // Two distinct error stages so we can return an opaque but useful code to
    // the client without ever reflecting the raw message into the URL.
    let stage: "exchange" | "register" = "exchange";
    try {
      const { guild } = await ctx.runAction(
        internal.discord.exchangeInstallCode,
        { code },
      );

      const botToken = process.env.DISCORD_BOT_TOKEN;
      const publicKey = process.env.DISCORD_PUBLIC_KEY;
      const applicationId = process.env.DISCORD_APPLICATION_ID;
      if (!botToken || !publicKey || !applicationId) {
        return Response.redirect(
          `${appUrl}/app/settings?error=server_not_configured`,
          302,
        );
      }

      stage = "register";
      const guildId = await ctx.runMutation(
        internal.guilds.registerFromInstall,
        {
          userId: nonce.userId,
          discordGuildId: guild.id,
          name: guild.name,
          iconUrl: guild.iconUrl,
          botToken,
          publicKey,
          applicationId,
        },
      );

      return Response.redirect(
        `${appUrl}/app/settings?installed=${guildId}`,
        302,
      );
    } catch (err) {
      console.error("discord_install_callback_failed", { stage, err });
      const code =
        stage === "exchange" ? "oauth_exchange_failed" : "oauth_register_failed";
      return Response.redirect(`${appUrl}/app/settings?error=${code}`, 302);
    }
  }),
});

// CORS preflight for the Discord-facing routes. Discord itself never sends
// an OPTIONS request (both `/interactions` and `/api/discord/install` are
// server-to-browser-redirect flows), but convex-doctor wants the preflight
// to exist so accidental fetches from a browser get a clean 405 for GET
// and POST instead of a silent CORS failure. Pin the origin to the
// configured SITE_URL when present. No wildcard fallback: the 2026-04-18
// audit flagged `Access-Control-Allow-Origin: *` here as LOW risk since
// Discord never uses the preflight, but we remove the wildcard so the
// routes are never accidentally usable as an open proxy from another
// origin. When SITE_URL is unset the preflight simply returns the method
// list without an origin, which fails closed for browsers.
function buildCorsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Signature-Ed25519, X-Signature-Timestamp",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  const siteUrl = process.env.SITE_URL;
  if (siteUrl) {
    headers["Access-Control-Allow-Origin"] = siteUrl;
  }
  return headers;
}

http.route({
  path: "/interactions",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: buildCorsHeaders() });
  }),
});

http.route({
  path: "/api/discord/install",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: buildCorsHeaders() });
  }),
});

// 4. Serve the built dashboard from Convex storage via @convex-dev/static-hosting.
registerStaticRoutes(http, components.selfHosting);

export default http;

// Walks the modal submit tree and plucks the value for each `custom_id`.
// Supports classic ACTION_ROW + TEXT_INPUT shape and the newer Label +
// STRING_SELECT shape. For selects we take the first option since forms
// never allow multi-select today.
function collectModalValues(
  payload: DiscordModalSubmitInteraction,
): Record<string, string> {
  const values: Record<string, string> = {};

  const visit = (node: DiscordModalComponentNode | undefined): void => {
    if (!node) return;
    if (typeof node.custom_id === "string") {
      if (typeof node.value === "string") {
        values[node.custom_id] = node.value;
      } else if (Array.isArray(node.values) && node.values.length > 0) {
        values[node.custom_id] = node.values[0];
      }
    }
    if (node.component) visit(node.component);
    if (Array.isArray(node.components)) {
      for (const child of node.components) visit(child);
    }
  };

  for (const root of payload.data?.components ?? []) visit(root);

  return values;
}

type ModalFormField = {
  id: string;
  label: string;
  type:
    | "short"
    | "paragraph"
    | "email"
    | "code"
    | "select"
    | "yes_no"
    | "checkbox"
    | "number";
  required: boolean;
  placeholder?: string;
  helperText?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  currencyUnit?: string;
  options?: Array<{ id: string; label: string }>;
};

// Picks the modal shape based on field mix. Classic action rows keep
// 100% compatibility with older Discord clients when the form is all
// text. Any option-based field forces Label mode so the string select
// has a proper label and optional description row.
function buildModalComponents(fields: Array<ModalFormField>): Array<unknown> {
  const hasOptionField = fields.some(
    (field) =>
      field.type === "select" ||
      field.type === "yes_no" ||
      field.type === "checkbox",
  );

  if (!hasOptionField) {
    return fields.map((field) => ({
      type: 1,
      components: [buildTextInput(field)],
    }));
  }

  return fields.map((field) => buildLabeledComponent(field));
}

function buildTextInput(field: ModalFormField) {
  const placeholder = buildPlaceholder(field);
  return {
    type: 4,
    custom_id: field.id,
    label: field.label.slice(0, 45),
    style: field.type === "paragraph" || field.type === "code" ? 2 : 1,
    required: field.required,
    placeholder,
    min_length: field.minLength,
    max_length: field.maxLength,
  };
}

// In Label mode we let the Label own the label text and description (the
// helper text), and the inner component owns only its custom_id / style.
function buildLabeledComponent(field: ModalFormField) {
  if (
    field.type === "select" ||
    field.type === "yes_no" ||
    field.type === "checkbox"
  ) {
    const options = field.options ?? [];
    return {
      type: 18,
      label: field.label.slice(0, 45),
      description: buildDescription(field),
      component: {
        type: 3,
        custom_id: field.id,
        placeholder: field.placeholder,
        min_values: field.required ? 1 : 0,
        max_values: 1,
        options: options.slice(0, 25).map((option) => ({
          label: option.label.slice(0, 100),
          value: option.id,
        })),
      },
    };
  }

  return {
    type: 18,
    label: field.label.slice(0, 45),
    description: buildDescription(field),
    component: {
      type: 4,
      custom_id: field.id,
      style: field.type === "paragraph" || field.type === "code" ? 2 : 1,
      required: field.required,
      placeholder: field.placeholder,
      min_length: field.minLength,
      max_length: field.maxLength,
    },
  };
}

// Discord does not render helper text on TEXT_INPUT, so in classic mode
// we append length/helper hints to the placeholder instead. This is the
// only channel submitters see before typing.
function buildPlaceholder(field: ModalFormField): string | undefined {
  const base = field.placeholder?.trim();
  const hints: Array<string> = [];
  if (field.helperText) hints.push(field.helperText);
  const rangeHint = buildLengthHint(field);
  if (rangeHint) hints.push(rangeHint);
  const numberHint = buildNumberHint(field);
  if (numberHint) hints.push(numberHint);
  if (field.type === "email") hints.push("email only, kept private");

  const merged = [base, hints.join(" · ")].filter(Boolean).join(" — ");
  return merged ? merged.slice(0, 100) : undefined;
}

// Label.description is the natural home for helper text. Falls back to
// the length hint when the admin did not supply anything.
function buildDescription(field: ModalFormField): string | undefined {
  const parts: Array<string> = [];
  if (field.helperText) parts.push(field.helperText);
  const rangeHint = buildLengthHint(field);
  if (rangeHint) parts.push(rangeHint);
  const numberHint = buildNumberHint(field);
  if (numberHint) parts.push(numberHint);
  if (field.type === "email")
    parts.push("Email used for contact only, not posted with your submission.");
  if (parts.length === 0) return undefined;
  return parts.join(" ").slice(0, 100);
}

function buildLengthHint(field: ModalFormField): string | undefined {
  if (field.type !== "short" && field.type !== "paragraph" && field.type !== "code")
    return undefined;
  if (field.minLength && field.maxLength)
    return `Must be ${field.minLength}-${field.maxLength} characters.`;
  if (field.maxLength) return `Max ${field.maxLength} characters.`;
  if (field.minLength) return `Min ${field.minLength} characters.`;
  return undefined;
}

// Number fields render as TEXT_INPUT (Discord has no native number input),
// so we nudge submitters in plain English. Currency unit is surfaced here
// too so a "USD" form reads as `Must be at most 1,000 USD.` before typing.
function buildNumberHint(field: ModalFormField): string | undefined {
  if (field.type !== "number") return undefined;
  const unit = field.currencyUnit ? ` ${field.currencyUnit}` : "";
  const fmt = (value: number) =>
    new Intl.NumberFormat("en-US").format(value) + unit;
  if (field.minValue !== undefined && field.maxValue !== undefined) {
    return `Must be between ${fmt(field.minValue)} and ${fmt(field.maxValue)}.`;
  }
  if (field.minValue !== undefined) return `Min ${fmt(field.minValue)}.`;
  if (field.maxValue !== undefined) return `Max ${fmt(field.maxValue)}.`;
  return "Numeric answer.";
}

function ephemeralResponse(content: string) {
  return Response.json({
    type: 4,
    data: {
      content,
      flags: 64,
    },
  });
}

function hasAllRoles(memberRoles: Array<string>, requiredRoleIds: Array<string>) {
  return requiredRoleIds.every((roleId) => memberRoles.includes(roleId));
}

function hasAnyRole(memberRoles: Array<string>, blockedRoleIds: Array<string>) {
  return blockedRoleIds.some((roleId) => memberRoles.includes(roleId));
}

// Discord's Administrator bit. `member.permissions` is a stringified bigint
// of the member's resolved channel permissions, so we parse with BigInt and
// AND against 0x8. Anything falsy (missing, unparseable) means "not admin".
function hasAdministratorPermission(permissions: string | undefined): boolean {
  if (!permissions) return false;
  try {
    return (BigInt(permissions) & 0x8n) === 0x8n;
  } catch {
    return false;
  }
}

// Per-button role gate for ticket mode. Returns an ephemeral message when
// the member is not allowed to press this button at all, otherwise returns
// `undefined` and lets the mutation run. The submitter-specific and
// assignee-specific rules are folded into the booleans passed in.
function ticketActionDenial(
  action: "claim" | "unclaim" | "resolve" | "reopen" | "close",
  flags: {
    canClaim: boolean;
    canUnclaim: boolean;
    canResolve: boolean;
    canClose: boolean;
    canReopen: boolean;
  },
): string | undefined {
  switch (action) {
    case "claim":
      return flags.canClaim
        ? undefined
        : "You do not have a role that can claim this ticket.";
    case "unclaim":
      return flags.canUnclaim
        ? undefined
        : "Only the assignee or a mod can unclaim this ticket.";
    case "resolve":
      return flags.canResolve
        ? undefined
        : "You do not have a role that can resolve this ticket.";
    case "close":
      return flags.canClose
        ? undefined
        : "Only the submitter or a mod can close this ticket.";
    case "reopen":
      return flags.canReopen
        ? undefined
        : "Only a mod can reopen a closed ticket.";
    default:
      return "That action could not be completed.";
  }
}

// Extracts the `<submissionId>` tail from `approve:<id>` and `deny:<id>`
// custom ids. Returns `undefined` if the prefix does not match so the
// handler can bail out with a clean ephemeral error.
function parseSubmissionIdFromCustomId(
  customId: string,
): Id<"submissions"> | undefined {
  if (customId.startsWith("approve:")) {
    return customId.slice("approve:".length) as Id<"submissions">;
  }
  if (customId.startsWith("deny:")) {
    return customId.slice("deny:".length) as Id<"submissions">;
  }
  return undefined;
}

// Ticket lifecycle actions reachable from the published message buttons.
// Keeping the allow-list here as a literal so new actions added in the
// future have to be whitelisted explicitly before Discord can trigger them.
const TICKET_ACTIONS = [
  "claim",
  "unclaim",
  "resolve",
  "reopen",
  "close",
] as const;
type TicketButtonAction = (typeof TICKET_ACTIONS)[number];

function parseTicketCustomId(
  customId: string,
): { action: TicketButtonAction; submissionId: Id<"submissions"> } | undefined {
  if (!customId.startsWith("ticket:")) return undefined;
  const parts = customId.split(":");
  if (parts.length !== 3) return undefined;
  const action = parts[1] as TicketButtonAction;
  if (!TICKET_ACTIONS.includes(action)) return undefined;
  const submissionId = parts[2] as Id<"submissions">;
  if (!submissionId) return undefined;
  return { action, submissionId };
}

// Shared handler for `ticket:*:<submissionId>` button clicks. Mirrors the
// auth pattern used by the approve/deny path: identify the moderator,
// confirm the submission exists and is a ticket-mode form, enforce the
// form-level mod role list if present, then delegate to the mutation.
// The mutation's `reason` code maps to a human message here so Discord
// always shows something actionable.
async function handleTicketButton(
  ctx: ActionCtx,
  customId: string,
  payload: DiscordComponentInteraction,
): Promise<Response> {
  const parsed = parseTicketCustomId(customId);
  if (!parsed) {
    return ephemeralResponse("This ticket action is no longer supported.");
  }

  const moderatorId =
    payload.member?.user?.id ?? payload.user?.id ?? undefined;
  const moderatorName =
    payload.member?.user?.global_name ??
    payload.member?.user?.username ??
    payload.user?.global_name ??
    payload.user?.username ??
    undefined;
  if (!moderatorId || !moderatorName) {
    return ephemeralResponse("Forge could not identify the moderator.");
  }

  const context = await ctx.runQuery(internal.submissions.routeContext, {
    submissionId: parsed.submissionId,
  });
  if (!context) {
    return ephemeralResponse("This submission is no longer available.");
  }
  if (!context.form.ticketMode) {
    return ephemeralResponse("Ticket mode is off for this form.");
  }

  const memberRoles = payload.member?.roles ?? [];
  const isAdmin = hasAdministratorPermission(payload.member?.permissions);
  const isMod = hasAnyRole(memberRoles, context.form.modRoleIds ?? []);
  const isSubmitter = context.submission.submitterId === moderatorId;
  const canClaim =
    isAdmin ||
    isMod ||
    hasAnyRole(memberRoles, context.form.ticketClaimRoleIds ?? []);
  const canResolve =
    isAdmin ||
    isMod ||
    isSubmitter ||
    hasAnyRole(memberRoles, context.form.ticketResolveRoleIds ?? []);
  const canClose = isAdmin || isMod || isSubmitter;
  const canReopen = isAdmin || isMod;
  // Unclaim is allowed for the current assignee too; the mutation enforces
  // that rule strictly with `not_assignee`, so we only need to let the
  // request through here without a role.
  const isAssignee =
    !!context.submission.assignedToUserId &&
    context.submission.assignedToUserId === moderatorId;
  const canUnclaim = isAdmin || isMod || isAssignee;

  // Allowed returns `undefined` when the role/admin check passes. The
  // assignee-only unclaim rule still lives in `applyTicketAction`; here we
  // only check the "can this role touch this button at all" question.
  const denialMessage = ticketActionDenial(parsed.action, {
    canClaim,
    canUnclaim,
    canResolve,
    canClose,
    canReopen,
  });
  if (denialMessage) {
    return ephemeralResponse(denialMessage);
  }

  const result = await ctx.runMutation(
    internal.submissions.recordTicketAction,
    {
      submissionId: parsed.submissionId,
      action: parsed.action,
      actorId: moderatorId,
      actorName: moderatorName,
    },
  );

  if (!result.ok) {
    return ephemeralResponse(ticketReasonMessage(result.reason));
  }

  const okMessage =
    parsed.action === "claim"
      ? `Claimed by ${moderatorName}.`
      : parsed.action === "unclaim"
        ? "Unclaimed."
        : parsed.action === "resolve"
          ? "Ticket resolved."
          : parsed.action === "reopen"
            ? "Ticket reopened."
            : "Ticket closed.";
  return ephemeralResponse(okMessage);
}

// Map the internal `reason` codes returned by `applyTicketAction` to a
// friendly ephemeral message. Unknown codes fall back to a generic
// message so a future reason code never leaks into chat raw.
function ticketReasonMessage(reason: string | undefined): string {
  switch (reason) {
    case "submission_not_found":
      return "This ticket no longer exists.";
    case "not_ticket_form":
      return "Ticket mode is off for this form.";
    case "ticket_closed":
      return "This ticket is closed. Reopen it first.";
    case "already_claimed":
      return "Someone else already claimed this ticket.";
    case "not_assignee":
      return "Only the assignee can unclaim this ticket.";
    case "ticket_already_open":
      return "This ticket is already open.";
    case "already_closed":
      return "This ticket is already closed.";
    default:
      return "That action could not be completed.";
  }
}
