// ==========================================================
// Atlas
// organizations.ts
// Drizzle ORM Schema
// ==========================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

//
// ENUMS
//

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "FREE",
  "STARTER",
  "PROFESSIONAL",
  "BUSINESS",
  "ENTERPRISE",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "TRIAL",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
  "EXPIRED",
]);

//
// TABLE
//

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey(),

    // Identity
    legalName: varchar("legal_name", { length: 255 }).notNull(),

    displayName: varchar("display_name", { length: 255 }).notNull(),

    slug: varchar("slug", { length: 100 }).notNull(),

    registrationNumber: varchar("registration_number", {
      length: 100,
    }),

    taxNumber: varchar("tax_number", {
      length: 100,
    }),

    // Contact
    email: varchar("email", {
      length: 255,
    }).notNull(),

    phone: varchar("phone", {
      length: 50,
    }),

    website: text("website"),

    // Branding
    logoUrl: text("logo_url"),

    primaryColor: varchar("primary_color", {
      length: 20,
    }),

    secondaryColor: varchar("secondary_color", {
      length: 20,
    }),

    // Address
    addressLine1: text("address_line_1"),

    addressLine2: text("address_line_2"),

    city: varchar("city", {
      length: 100,
    }),

    stateProvince: varchar("state_province", {
      length: 100,
    }),

    postalCode: varchar("postal_code", {
      length: 30,
    }),

    country: varchar("country", {
      length: 100,
    }).notNull(),

    // Regional

    timezone: varchar("timezone", {
      length: 100,
    })
      .default("UTC")
      .notNull(),

    locale: varchar("locale", {
      length: 20,
    })
      .default("en-ZA")
      .notNull(),

    currency: varchar("currency", {
      length: 10,
    })
      .default("ZAR")
      .notNull(),

    // Subscription

    subscriptionPlan: subscriptionPlanEnum(
      "subscription_plan"
    ).notNull(),

    subscriptionStatus: subscriptionStatusEnum(
      "subscription_status"
    ).notNull(),

    trialEndsAt: timestamp("trial_ends_at", {
      withTimezone: true,
    }),

    subscriptionRenewsAt: timestamp(
      "subscription_renews_at",
      {
        withTimezone: true,
      }
    ),

    // Features

    aiEnabled: boolean("ai_enabled")
      .default(true)
      .notNull(),

    voiceEnabled: boolean("voice_enabled")
      .default(true)
      .notNull(),

    mobileEnabled: boolean("mobile_enabled")
      .default(true)
      .notNull(),

    apiEnabled: boolean("api_enabled")
      .default(true)
      .notNull(),

    // Security

    requireMfa: boolean("require_mfa")
      .default(false)
      .notNull(),

    sessionTimeoutMinutes: integer(
      "session_timeout_minutes"
    )
      .default(60)
      .notNull(),

    passwordPolicy: jsonb("password_policy"),

    // Retention

    documentRetentionDays: integer(
      "document_retention_days"
    ).default(2555),

    auditRetentionDays: integer(
      "audit_retention_days"
    ).default(2555),

    voiceRetentionDays: integer(
      "voice_retention_days"
    ).default(365),

    // Audit

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    createdBy: uuid("created_by"),

    updatedBy: uuid("updated_by"),

    archivedAt: timestamp("archived_at", {
      withTimezone: true,
    }),
  },

  (table) => ({
    slugIdx: uniqueIndex("org_slug_idx").on(table.slug),

    emailIdx: index("org_email_idx").on(table.email),

    countryIdx: index("org_country_idx").on(table.country),

    subscriptionIdx: index("org_subscription_idx").on(
      table.subscriptionStatus
    ),

    createdAtIdx: index("org_created_at_idx").on(
      table.createdAt
    ),

    archivedIdx: index("org_archived_at_idx").on(
      table.archivedAt
    ),
  })
);