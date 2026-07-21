"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    companyName: "",
    defaultTimezone: "UTC",
    emailNotifications: true,
    slackIntegration: false,
    autoBackup: true,
  });

  const handleSave = () => {
    // TODO: Save settings to API
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-surface rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) =>
                  setSettings({ ...settings, companyName: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted dark:bg-card border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                placeholder="Your company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Default Timezone
              </label>
              <select
                value={settings.defaultTimezone}
                onChange={(e) =>
                  setSettings({ ...settings, defaultTimezone: e.target.value })
                }
                className="w-full px-3 py-2 bg-muted dark:bg-card border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-surface rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Notification Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Email Notifications
                </div>
                <div className="text-sm text-muted-foreground">
                  Receive email updates for important events
                </div>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    emailNotifications: !settings.emailNotifications,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.emailNotifications ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${settings.emailNotifications ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Slack Integration
                </div>
                <div className="text-sm text-muted-foreground">
                  Send notifications to Slack channels
                </div>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    slackIntegration: !settings.slackIntegration,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.slackIntegration ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${settings.slackIntegration ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Data Settings */}
        <div className="bg-surface rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Data Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Auto Backup
                </div>
                <div className="text-sm text-muted-foreground">
                  Automatically backup data daily
                </div>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, autoBackup: !settings.autoBackup })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoBackup ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${settings.autoBackup ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-info text-foreground rounded-lg hover:bg-info transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
