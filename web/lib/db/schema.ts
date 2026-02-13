import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──

export const userRoleEnum = pgEnum("user_role", ["user", "mod", "admin"]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "pending",
  "approved",
  "rejected",
  "applied",
  "failed",
]);

export const proposalTypeEnum = pgEnum("proposal_type", [
  "add-node",
  "edit-node",
  "delete-node",
  "add-edge",
  "edit-edge",
  "delete-edge",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "proposal_created",
  "proposal_approved",
  "proposal_rejected",
  "proposal_applied",
  "proposal_failed",
  "direct_add_node",
  "direct_edit_node",
  "direct_delete_node",
  "direct_add_edge",
  "direct_edit_edge",
  "direct_delete_edge",
  "squash",
]);

// ── Users (NextAuth compatible) ──

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── NextAuth Accounts ──

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
);

// ── NextAuth Sessions ──

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ── NextAuth Verification Tokens ──

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ── Proposals ──

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: proposalTypeEnum("type").notNull(),
    status: proposalStatusEnum("status").default("pending").notNull(),
    targetNodeId: text("target_node_id"),
    targetEdgeId: text("target_edge_id"),
    dataBefore: jsonb("data_before"),
    dataAfter: jsonb("data_after"),
    reason: text("reason"),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewerId: uuid("reviewer_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    appliedAt: timestamp("applied_at", { mode: "date" }),
    errorMessage: text("error_message"),
    squashedIntoId: uuid("squashed_into_id"),
    isSquashSummary: boolean("is_squash_summary").default(false),
  },
  (table) => [
    index("proposals_status_idx").on(table.status),
    index("proposals_author_idx").on(table.authorId),
    index("proposals_target_node_idx").on(table.targetNodeId),
    index("proposals_created_at_idx").on(table.createdAt),
  ]
);

// ── Audit Log ──

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: auditActionEnum("action").notNull(),
    proposalId: uuid("proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetNodeId: text("target_node_id"),
    targetEdgeId: text("target_edge_id"),
    dataBefore: jsonb("data_before"),
    dataAfter: jsonb("data_after"),
    cypherExecuted: text("cypher_executed"),
    squashSummary: text("squash_summary"),
    squashedCount: integer("squashed_count"),
    squashedIntoId: uuid("squashed_into_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_user_idx").on(table.userId),
    index("audit_action_idx").on(table.action),
    index("audit_target_node_idx").on(table.targetNodeId),
    index("audit_created_at_idx").on(table.createdAt),
    index("audit_proposal_idx").on(table.proposalId),
  ]
);

// ── API Keys ──

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull().unique(), // SHA-256 hash
    prefix: text("prefix").notNull(), // first 8 chars for display
    name: text("name").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    revoked: boolean("revoked").default(false).notNull(),
  },
  (table) => [
    index("api_keys_key_idx").on(table.key),
    index("api_keys_user_idx").on(table.userId),
  ]
);

// ── Relations ──

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  proposals: many(proposals, { relationName: "author" }),
  reviews: many(proposals, { relationName: "reviewer" }),
  auditEntries: many(auditLog),
  apiKeys: many(apiKeys),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  author: one(users, {
    fields: [proposals.authorId],
    references: [users.id],
    relationName: "author",
  }),
  reviewer: one(users, {
    fields: [proposals.reviewerId],
    references: [users.id],
    relationName: "reviewer",
  }),
  auditEntries: many(auditLog),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  proposal: one(proposals, {
    fields: [auditLog.proposalId],
    references: [proposals.id],
  }),
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));
