// Forms list/read/edit surface for the dashboard. A form maps 1:1 to a Discord
// slash command inside a connected guild.

import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAllowedViewer } from "./lib/auth";

const COMMAND_NAME_REGEX = /^[a-z0-9-]{1,32}$/;
const FIELD_ID_REGEX = /^[a-z0-9_]{4,48}$/;
const MAX_FIELDS = 5;

const formFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("short"),
    v.literal("paragraph"),
    v.literal("email"),
    v.literal("code"),
    v.literal("select"),
    v.literal("yes_no"),
    v.literal("checkbox"),
    v.literal("number"),
  ),
  required: v.boolean(),
  placeholder: v.optional(v.string()),
  helperText: v.optional(v.string()),
  minLength: v.optional(v.number()),
  maxLength: v.optional(v.number()),
  minValue: v.optional(v.number()),
  maxValue: v.optional(v.number()),
  currencyUnit: v.optional(v.string()),
  options: v.optional(
    v.array(
      v.object({
        id: v.string(),
        label: v.string(),
      }),
    ),
  ),
});

const formSummaryValidator = v.object({
  _id: v.id("forms"),
  _creationTime: v.number(),
  guildId: v.id("guilds"),
  title: v.string(),
  commandName: v.string(),
  commandDescription: v.string(),
  requiresApproval: v.boolean(),
  published: v.boolean(),
  destinationType: v.optional(v.union(v.literal("text"), v.literal("forum"))),
  fieldCount: v.number(),
});

const editableFormValidator = v.object({
  _id: v.id("forms"),
  _creationTime: v.number(),
  guildId: v.id("guilds"),
  commandName: v.string(),
  commandDescription: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  fields: v.array(formFieldValidator),
  requiresApproval: v.boolean(),
  modQueueChannelId: v.optional(v.string()),
  destinationChannelId: v.optional(v.string()),
  destinationType: v.optional(v.union(v.literal("text"), v.literal("forum"))),
  forumTagId: v.optional(v.string()),
  titleSource: v.union(v.literal("static"), v.literal("field")),
  titleTemplate: v.optional(v.string()),
  titleFieldId: v.optional(v.string()),
  requiredRoleIds: v.optional(v.array(v.string())),
  restrictedRoleIds: v.optional(v.array(v.string())),
  modRoleIds: v.optional(v.array(v.string())),
  cooldownSeconds: v.optional(v.number()),
  successMessage: v.optional(v.string()),
  maxSubmissionsPerUser: v.optional(v.number()),
  maxSubmissionsPerDay: v.optional(v.number()),
  showModeratorInFooter: v.optional(v.boolean()),
  linkSubmitterOnPublish: v.optional(v.boolean()),
  ticketMode: v.optional(v.boolean()),
  autoCloseInactiveDays: v.optional(v.number()),
  published: v.boolean(),
  discordCommandId: v.optional(v.string()),
});

const modalFormValidator = v.object({
  _id: v.id("forms"),
  guildId: v.id("guilds"),
  title: v.string(),
  description: v.optional(v.string()),
  requiresApproval: v.boolean(),
  published: v.boolean(),
  fields: v.array(formFieldValidator),
  requiredRoleIds: v.optional(v.array(v.string())),
  restrictedRoleIds: v.optional(v.array(v.string())),
  successMessage: v.optional(v.string()),
  maxSubmissionsPerUser: v.optional(v.number()),
  maxSubmissionsPerDay: v.optional(v.number()),
});

const publishPayloadValidator = v.object({
  formId: v.id("forms"),
  guildId: v.id("guilds"),
  commandName: v.string(),
  commandDescription: v.string(),
  discordCommandId: v.optional(v.string()),
  applicationId: v.string(),
  discordGuildId: v.string(),
  botToken: v.string(),
});

export const list = query({
  args: { guildId: v.id("guilds") },
  returns: v.array(formSummaryValidator),
  handler: async (ctx, args) => {
    await requireAllowedUser(ctx);

    const rows = await ctx.db
      .query("forms")
      .withIndex("by_guildid_and_commandname", (q) =>
        q.eq("guildId", args.guildId),
      )
      .order("desc")
      .take(100);

    return rows.map(toFormSummary);
  },
});

export const get = query({
  args: { formId: v.id("forms") },
  returns: v.union(v.null(), editableFormValidator),
  handler: async (ctx, args) => {
    await requireAllowedUser(ctx);

    const row = await ctx.db.get("forms", args.formId);
    return row ? toEditableForm(row) : null;
  },
});

export const create = mutation({
  args: {
    guildId: v.id("guilds"),
    title: v.string(),
    commandName: v.string(),
    commandDescription: v.string(),
  },
  returns: v.id("forms"),
  handler: async (ctx, args) => {
    await requireAllowedUser(ctx);

    const guild = await ctx.db.get("guilds", args.guildId);
    if (!guild) {
      throw new ConvexError({ code: "guild_not_found" });
    }

    const title = normalizeTitle(args.title);
    const commandName = normalizeCommandName(args.commandName);
    const commandDescription = normalizeDescription(args.commandDescription);

    await ensureUniqueCommandName(ctx, args.guildId, commandName, null);

    return await ctx.db.insert("forms", {
      guildId: args.guildId,
      commandName,
      commandDescription,
      title,
      description: undefined,
      fields: [],
      requiresApproval: true,
      modQueueChannelId: guild.defaultModQueueChannelId,
      destinationChannelId: guild.defaultDestinationChannelId,
      destinationType: guild.defaultDestinationType,
      forumTagId: guild.defaultForumTagId,
      titleSource: "static",
      titleTemplate: title,
      titleFieldId: undefined,
      requiredRoleIds: undefined,
      restrictedRoleIds: undefined,
      modRoleIds: undefined,
      cooldownSeconds: undefined,
      successMessage: undefined,
      maxSubmissionsPerUser: undefined,
      maxSubmissionsPerDay: undefined,
      published: false,
      discordCommandId: undefined,
    });
  },
});

export const update = mutation({
  args: {
    formId: v.id("forms"),
    title: v.string(),
    commandName: v.string(),
    commandDescription: v.string(),
    description: v.optional(v.string()),
    requiresApproval: v.boolean(),
    fields: v.array(formFieldValidator),
    modQueueChannelId: v.optional(v.string()),
    destinationChannelId: v.optional(v.string()),
    destinationType: v.optional(v.union(v.literal("text"), v.literal("forum"))),
    forumTagId: v.optional(v.string()),
    requiredRoleIds: v.optional(v.array(v.string())),
    restrictedRoleIds: v.optional(v.array(v.string())),
    modRoleIds: v.optional(v.array(v.string())),
    successMessage: v.optional(v.string()),
    maxSubmissionsPerUser: v.optional(v.number()),
    maxSubmissionsPerDay: v.optional(v.number()),
    showModeratorInFooter: v.optional(v.boolean()),
    linkSubmitterOnPublish: v.optional(v.boolean()),
    ticketMode: v.optional(v.boolean()),
    autoCloseInactiveDays: v.optional(v.number()),
  },
  returns: editableFormValidator,
  handler: async (ctx, args) => {
    await requireAllowedUser(ctx);

    const existing = await ctx.db.get("forms", args.formId);
    if (!existing) {
      throw new ConvexError({ code: "form_not_found" });
    }

    const title = normalizeTitle(args.title);
    const commandName = normalizeCommandName(args.commandName);
    const commandDescription = normalizeDescription(args.commandDescription);
    const description = normalizeOptionalLongText(args.description);
    const fields = normalizeFields(args.fields);
    const requiredRoleIds = normalizeRoleIds(args.requiredRoleIds);
    const restrictedRoleIds = normalizeRoleIds(args.restrictedRoleIds);
    const modRoleIds = normalizeRoleIds(args.modRoleIds);
    const successMessage = normalizeSuccessMessage(args.successMessage);
    const maxSubmissionsPerUser = normalizeOptionalPositiveInt(
      args.maxSubmissionsPerUser,
      "max_submissions_per_user_invalid",
    );
    const maxSubmissionsPerDay = normalizeOptionalPositiveInt(
      args.maxSubmissionsPerDay,
      "max_submissions_per_day_invalid",
    );
    // Auto-close window is optional, must be a positive integer if set, and
    // we cap at 365 days so a typo can't park a ticket forever off-screen.
    const autoCloseInactiveDays = normalizeAutoCloseDays(
      args.autoCloseInactiveDays,
    );
    const channels = await ctx.db
      .query("guildChannels")
      .withIndex("by_guildid_and_position", (q) =>
        q.eq("guildId", existing.guildId),
      )
      .take(500);
    const roles = await ctx.db
      .query("guildRoles")
      .withIndex("by_guildid_and_position", (q) =>
        q.eq("guildId", existing.guildId),
      )
      .take(500);
    const channelById = new Map(
      channels.map((channel) => [channel.discordChannelId, channel]),
    );
    const roleById = new Map(roles.map((role) => [role.discordRoleId, role]));

    validateTextChannel(
      channelById,
      args.modQueueChannelId,
      "mod_queue_channel_invalid",
    );
    validateDestinationSelection(
      channelById,
      args.destinationChannelId,
      args.destinationType,
      args.forumTagId,
    );
    validateRoleSelection(roleById, requiredRoleIds, "required_role_invalid");
    validateRoleSelection(
      roleById,
      restrictedRoleIds,
      "restricted_role_invalid",
    );
    validateRoleSelection(roleById, modRoleIds, "mod_role_invalid");
    const publishConfigChanged =
      existing.title !== title ||
      existing.commandName !== commandName ||
      existing.commandDescription !== commandDescription ||
      existing.requiresApproval !== args.requiresApproval ||
      JSON.stringify(existing.fields) !== JSON.stringify(fields) ||
      JSON.stringify(existing.requiredRoleIds ?? []) !==
        JSON.stringify(requiredRoleIds ?? []) ||
      JSON.stringify(existing.restrictedRoleIds ?? []) !==
        JSON.stringify(restrictedRoleIds ?? []) ||
      JSON.stringify(existing.modRoleIds ?? []) !==
        JSON.stringify(modRoleIds ?? []) ||
      existing.successMessage !== successMessage ||
      existing.maxSubmissionsPerUser !== maxSubmissionsPerUser ||
      existing.maxSubmissionsPerDay !== maxSubmissionsPerDay;

    await ensureUniqueCommandName(ctx, existing.guildId, commandName, existing._id);

    const nextTitleTemplate =
      existing.titleSource === "static" &&
      (existing.titleTemplate === undefined || existing.titleTemplate === existing.title)
        ? title
        : existing.titleTemplate;

    await ctx.db.patch("forms", existing._id, {
      title,
      commandName,
      commandDescription,
      description,
      requiresApproval: args.requiresApproval,
      fields,
      modQueueChannelId: args.modQueueChannelId,
      destinationChannelId: args.destinationChannelId,
      destinationType: args.destinationType,
      forumTagId: args.forumTagId,
      requiredRoleIds,
      restrictedRoleIds,
      modRoleIds,
      successMessage,
      maxSubmissionsPerUser,
      maxSubmissionsPerDay,
      showModeratorInFooter: args.showModeratorInFooter,
      linkSubmitterOnPublish: args.linkSubmitterOnPublish,
      ticketMode: args.ticketMode,
      autoCloseInactiveDays,
      titleTemplate: nextTitleTemplate,
      published: publishConfigChanged ? false : existing.published,
    });

    const updated = await ctx.db.get("forms", existing._id);
    if (!updated) {
      throw new ConvexError({ code: "form_not_found" });
    }

    return toEditableForm(updated);
  },
});

export const getForPublish = internalQuery({
  args: { formId: v.id("forms") },
  returns: v.union(v.null(), publishPayloadValidator),
  handler: async (ctx, args) => {
    const form = await ctx.db.get("forms", args.formId);
    if (!form) {
      return null;
    }

    const guild = await ctx.db.get("guilds", form.guildId);
    if (!guild) {
      throw new ConvexError({ code: "guild_not_found" });
    }

    validateFormReadyForPublish(form);

    return {
      formId: form._id,
      guildId: form.guildId,
      commandName: form.commandName,
      commandDescription: form.commandDescription,
      discordCommandId: form.discordCommandId,
      applicationId: guild.applicationId,
      discordGuildId: guild.discordGuildId,
      botToken: guild.botToken,
    };
  },
});

export const getByCommand = internalQuery({
  args: {
    discordGuildId: v.string(),
    commandName: v.string(),
  },
  returns: v.union(v.null(), modalFormValidator),
  handler: async (ctx, args) => {
    const commandName = normalizeCommandName(args.commandName);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordguildid", (q) =>
        q.eq("discordGuildId", args.discordGuildId),
      )
      .unique();
    if (!guild) {
      return null;
    }
    const form = await ctx.db
      .query("forms")
      .withIndex("by_guildid_and_commandname", (q) =>
        q.eq("guildId", guild._id).eq("commandName", commandName),
      )
      .unique();
    if (!form) {
      return null;
    }
    return toModalForm(form);
  },
});

export const getForModalSubmit = internalQuery({
  args: { formId: v.id("forms") },
  returns: v.union(v.null(), modalFormValidator),
  handler: async (ctx, args) => {
    const form = await ctx.db.get("forms", args.formId);
    return form ? toModalForm(form) : null;
  },
});

export const setPublicationState = internalMutation({
  args: {
    formId: v.id("forms"),
    published: v.boolean(),
    discordCommandId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const form = await ctx.db.get("forms", args.formId);
    if (!form) {
      throw new ConvexError({ code: "form_not_found" });
    }

    await ctx.db.patch("forms", form._id, {
      published: args.published,
      discordCommandId: args.discordCommandId,
    });
    return null;
  },
});

async function requireAllowedUser(ctx: QueryCtx | MutationCtx) {
  return await requireAllowedViewer(ctx);
}

async function ensureUniqueCommandName(
  ctx: MutationCtx,
  guildId: Id<"guilds">,
  commandName: string,
  currentFormId: Id<"forms"> | null,
) {
  const existing = await ctx.db
    .query("forms")
    .withIndex("by_guildid_and_commandname", (q) =>
      q.eq("guildId", guildId).eq("commandName", commandName),
    )
    .unique();

  if (existing && existing._id !== currentFormId) {
    throw new ConvexError({
      code: "command_name_taken",
      commandName,
    });
  }
}

function normalizeTitle(input: string): string {
  const title = input.trim();
  if (title.length === 0) {
    throw new ConvexError({ code: "title_required" });
  }
  if (title.length > 80) {
    throw new ConvexError({ code: "title_too_long", max: 80 });
  }
  return title;
}

function normalizeCommandName(input: string): string {
  const commandName = input.trim().toLowerCase();
  if (!COMMAND_NAME_REGEX.test(commandName)) {
    throw new ConvexError({
      code: "invalid_command_name",
      message:
        "Use 1 to 32 lowercase letters, numbers, or hyphens. No slash.",
    });
  }
  return commandName;
}

function normalizeDescription(input: string): string {
  const description = input.trim();
  if (description.length === 0) {
    throw new ConvexError({ code: "description_required" });
  }
  if (description.length > 100) {
    throw new ConvexError({ code: "description_too_long", max: 100 });
  }
  return description;
}

function normalizeOptionalLongText(input: string | undefined): string | undefined {
  const value = input?.trim();
  if (!value) {
    return undefined;
  }
  if (value.length > 500) {
    throw new ConvexError({ code: "form_description_too_long", max: 500 });
  }
  return value;
}

function normalizeFields(fields: Array<Doc<"forms">["fields"][number]>) {
  if (fields.length > MAX_FIELDS) {
    throw new ConvexError({ code: "too_many_fields", max: MAX_FIELDS });
  }

  const seen = new Set<string>();
  return fields.map((field, index) => {
    const id = field.id.trim().toLowerCase();
    if (!FIELD_ID_REGEX.test(id)) {
      throw new ConvexError({
        code: "invalid_field_id",
        index,
      });
    }
    if (seen.has(id)) {
      throw new ConvexError({ code: "duplicate_field_id", id });
    }
    seen.add(id);

    const label = field.label.trim();
    if (label.length === 0) {
      throw new ConvexError({ code: "field_label_required", index });
    }
    if (label.length > 45) {
      throw new ConvexError({ code: "field_label_too_long", index, max: 45 });
    }

    const placeholder = field.placeholder?.trim() || undefined;
    if (placeholder && placeholder.length > 100) {
      throw new ConvexError({
        code: "field_placeholder_too_long",
        index,
        max: 100,
      });
    }

    const helperText = field.helperText?.trim() || undefined;
    if (helperText && helperText.length > 100) {
      throw new ConvexError({
        code: "field_helper_text_too_long",
        index,
        max: 100,
      });
    }

    // Text-ish types keep the existing 0..4000 length knobs. Option-based
    // types and number ignore length because the answer isn't a free string.
    const isOptionType =
      field.type === "select" ||
      field.type === "yes_no" ||
      field.type === "checkbox";
    const isNumberType = field.type === "number";
    const isLengthType = !isOptionType && !isNumberType;

    const minLength = isLengthType
      ? normalizeOptionalLength(field.minLength, 0, 4000)
      : undefined;
    const maxLength = isLengthType
      ? normalizeOptionalLength(field.maxLength, 1, 4000)
      : undefined;

    if (
      minLength !== undefined &&
      maxLength !== undefined &&
      minLength > maxLength
    ) {
      throw new ConvexError({ code: "field_length_range_invalid", index });
    }

    const options = normalizeFieldOptions(field.type, field.options, index);

    // Number-only knobs. Both bounds must be finite, and when both are set
    // the minimum must be at or below the maximum. Currency is a 16-char
    // label; we intentionally do not validate it against a currency list
    // because admins may want arbitrary units like "credits" or "sats".
    const { minValue, maxValue, currencyUnit } = normalizeNumberFieldBounds(
      field.type,
      field.minValue,
      field.maxValue,
      field.currencyUnit,
      index,
    );

    return {
      id,
      label,
      type: field.type,
      required: field.required,
      placeholder,
      helperText,
      minLength,
      maxLength,
      minValue,
      maxValue,
      currencyUnit,
      options,
    };
  });
}

function normalizeAutoCloseDays(input: number | undefined): number | undefined {
  if (input === undefined) return undefined;
  if (!Number.isFinite(input)) {
    throw new ConvexError({ code: "auto_close_days_invalid" });
  }
  const int = Math.floor(input);
  if (int <= 0) return undefined;
  if (int > 365) {
    throw new ConvexError({ code: "auto_close_days_too_large", max: 365 });
  }
  return int;
}

function normalizeNumberFieldBounds(
  type: Doc<"forms">["fields"][number]["type"],
  minValue: number | undefined,
  maxValue: number | undefined,
  currencyUnit: string | undefined,
  index: number,
) {
  if (type !== "number") {
    return {
      minValue: undefined,
      maxValue: undefined,
      currencyUnit: undefined,
    };
  }

  const validatedMin = normalizeOptionalFiniteNumber(
    minValue,
    "field_min_value_invalid",
    index,
  );
  const validatedMax = normalizeOptionalFiniteNumber(
    maxValue,
    "field_max_value_invalid",
    index,
  );
  if (
    validatedMin !== undefined &&
    validatedMax !== undefined &&
    validatedMin > validatedMax
  ) {
    throw new ConvexError({ code: "field_value_range_invalid", index });
  }
  const unit = currencyUnit?.trim();
  if (unit && unit.length > 16) {
    throw new ConvexError({
      code: "field_currency_unit_too_long",
      index,
      max: 16,
    });
  }
  return {
    minValue: validatedMin,
    maxValue: validatedMax,
    currencyUnit: unit && unit.length > 0 ? unit : undefined,
  };
}

function normalizeOptionalFiniteNumber(
  input: number | undefined,
  code: string,
  index: number,
) {
  if (input === undefined) return undefined;
  if (!Number.isFinite(input)) {
    throw new ConvexError({ code, index });
  }
  return input;
}

// Option-based fields (select, yes_no, checkbox) need a fixed option set so
// the Discord string select value maps cleanly back to a recorded answer.
// yes_no is always forced to the canonical pair so the stored value is
// predictable across forms.
function normalizeFieldOptions(
  type: Doc<"forms">["fields"][number]["type"],
  options: Array<{ id: string; label: string }> | undefined,
  index: number,
): Array<{ id: string; label: string }> | undefined {
  if (type === "yes_no") {
    return [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ];
  }

  if (type !== "select" && type !== "checkbox") {
    return undefined;
  }

  const list = (options ?? []).map((option, optionIndex) => {
    const optionId = option.id.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,32}$/.test(optionId)) {
      throw new ConvexError({
        code: "field_option_id_invalid",
        index,
        optionIndex,
      });
    }
    const optionLabel = option.label.trim();
    if (optionLabel.length === 0) {
      throw new ConvexError({
        code: "field_option_label_required",
        index,
        optionIndex,
      });
    }
    if (optionLabel.length > 100) {
      throw new ConvexError({
        code: "field_option_label_too_long",
        index,
        optionIndex,
        max: 100,
      });
    }
    return { id: optionId, label: optionLabel };
  });

  const seenOption = new Set<string>();
  for (const option of list) {
    if (seenOption.has(option.id)) {
      throw new ConvexError({
        code: "field_option_id_duplicate",
        index,
        id: option.id,
      });
    }
    seenOption.add(option.id);
  }

  if (type === "checkbox") {
    if (list.length !== 1) {
      throw new ConvexError({ code: "checkbox_requires_one_option", index });
    }
  } else {
    if (list.length < 2) {
      throw new ConvexError({ code: "select_requires_two_options", index });
    }
    if (list.length > 25) {
      throw new ConvexError({ code: "select_too_many_options", index, max: 25 });
    }
  }

  return list;
}

function normalizeOptionalLength(
  value: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConvexError({ code: "field_length_out_of_range", min, max });
  }
  return value;
}

function normalizeRoleIds(roleIds: Array<string> | undefined) {
  if (!roleIds || roleIds.length === 0) {
    return undefined;
  }

  const unique = Array.from(
    new Set(
      roleIds
        .map((roleId) => roleId.trim())
        .filter((roleId) => roleId.length > 0),
    ),
  );

  return unique.length > 0 ? unique : undefined;
}

function normalizeSuccessMessage(input: string | undefined) {
  const value = input?.trim();
  if (!value) {
    return undefined;
  }
  if (value.length > 500) {
    throw new ConvexError({ code: "success_message_too_long", max: 500 });
  }
  return value;
}

function normalizeOptionalPositiveInt(
  value: number | undefined,
  code: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1 || value > 10000) {
    throw new ConvexError({ code, min: 1, max: 10000 });
  }
  return value;
}

function validateFormReadyForPublish(form: Doc<"forms">) {
  if (form.fields.length === 0) {
    throw new ConvexError({ code: "publish_requires_fields" });
  }
  normalizeFields(form.fields);
  normalizeRoleIds(form.requiredRoleIds);
  normalizeRoleIds(form.restrictedRoleIds);
  normalizeSuccessMessage(form.successMessage);
}

function validateTextChannel(
  channelById: Map<string, Doc<"guildChannels">>,
  channelId: string | undefined,
  code: string,
) {
  if (!channelId) {
    return;
  }

  const channel = channelById.get(channelId);
  if (!channel || channel.type !== "text") {
    throw new ConvexError({ code });
  }
}

function validateDestinationSelection(
  channelById: Map<string, Doc<"guildChannels">>,
  destinationChannelId: string | undefined,
  destinationType: "text" | "forum" | undefined,
  forumTagId: string | undefined,
) {
  if (!destinationChannelId && !destinationType && !forumTagId) {
    return;
  }

  if (!destinationChannelId || !destinationType) {
    throw new ConvexError({ code: "destination_incomplete" });
  }

  const destination = channelById.get(destinationChannelId);
  if (!destination || destination.type !== destinationType) {
    throw new ConvexError({ code: "destination_channel_invalid" });
  }

  if (destinationType === "forum") {
    if (
      forumTagId &&
      !destination.availableTags?.some((tag) => tag.id === forumTagId)
    ) {
      throw new ConvexError({ code: "forum_tag_invalid" });
    }
    return;
  }

  if (forumTagId) {
    throw new ConvexError({ code: "forum_tag_requires_forum_destination" });
  }
}

function validateRoleSelection(
  roleById: Map<string, Doc<"guildRoles">>,
  roleIds: Array<string> | undefined,
  code: string,
) {
  if (!roleIds || roleIds.length === 0) {
    return;
  }

  for (const roleId of roleIds) {
    if (!roleById.has(roleId)) {
      throw new ConvexError({ code, roleId });
    }
  }
}

function toFormSummary(row: Doc<"forms">) {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    guildId: row.guildId,
    title: row.title,
    commandName: row.commandName,
    commandDescription: row.commandDescription,
    requiresApproval: row.requiresApproval,
    published: row.published,
    destinationType: row.destinationType,
    fieldCount: row.fields.length,
  };
}

function toEditableForm(row: Doc<"forms">) {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    guildId: row.guildId,
    commandName: row.commandName,
    commandDescription: row.commandDescription,
    title: row.title,
    description: row.description,
    fields: row.fields,
    requiresApproval: row.requiresApproval,
    modQueueChannelId: row.modQueueChannelId,
    destinationChannelId: row.destinationChannelId,
    destinationType: row.destinationType,
    forumTagId: row.forumTagId,
    titleSource: row.titleSource,
    titleTemplate: row.titleTemplate,
    titleFieldId: row.titleFieldId,
    requiredRoleIds: row.requiredRoleIds,
    restrictedRoleIds: row.restrictedRoleIds,
    modRoleIds: row.modRoleIds,
    cooldownSeconds: row.cooldownSeconds,
    successMessage: row.successMessage,
    maxSubmissionsPerUser: row.maxSubmissionsPerUser,
    maxSubmissionsPerDay: row.maxSubmissionsPerDay,
    showModeratorInFooter: row.showModeratorInFooter,
    linkSubmitterOnPublish: row.linkSubmitterOnPublish,
    ticketMode: row.ticketMode,
    autoCloseInactiveDays: row.autoCloseInactiveDays,
    published: row.published,
    discordCommandId: row.discordCommandId,
  };
}

function toModalForm(row: Doc<"forms">) {
  return {
    _id: row._id,
    guildId: row.guildId,
    title: row.title,
    description: row.description,
    requiresApproval: row.requiresApproval,
    published: row.published,
    fields: row.fields,
    requiredRoleIds: row.requiredRoleIds,
    restrictedRoleIds: row.restrictedRoleIds,
    successMessage: row.successMessage,
    maxSubmissionsPerUser: row.maxSubmissionsPerUser,
    maxSubmissionsPerDay: row.maxSubmissionsPerDay,
  };
}
