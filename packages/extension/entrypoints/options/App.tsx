import React, { useState } from 'react';
import { Key, MessageSquare, Settings2, LayoutDashboard } from 'lucide-react';
import APIKeysSection from './sections/APIKeysSection';
import TonePromptsSection from './sections/TonePromptsSection';
import GeneralSettingsSection from './sections/GeneralSettingsSection';

// Section type
type SectionId = 'api-keys' | 'tone-prompts' | 'general';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'api-keys', label: 'API Keys', icon: <Key className="tw-w-4 tw-h-4" /> },
  { id: 'tone-prompts', label: 'Tone Prompts', icon: <MessageSquare className="tw-w-4 tw-h-4" /> },
  { id: 'general', label: 'General', icon: <Settings2 className="tw-w-4 tw-h-4" /> }
];

export default function App() {
  const [selectedSection, setSelectedSection] = useState<SectionId>('api-keys');

  return (
    <div className="tw-flex tw-min-h-screen tw-bg-background tw-font-sans tw-text-foreground">
      {/* Sidebar */}
      <aside className="tw-w-64 tw-border-r tw-border-border tw-bg-background">
        {/* Acme Inc. Style Header */}
        <div className="tw-h-14 tw-flex tw-items-center tw-px-4 tw-border-b tw-border-border">
          <div className="tw-flex tw-items-center tw-gap-2 tw-font-semibold">
            <div className="tw-flex tw-h-6 tw-w-6 tw-items-center tw-justify-center tw-rounded-full tw-bg-primary tw-text-primary-foreground">
              <LayoutDashboard className="tw-h-3 tw-w-3" />
            </div>
            <span>Lomen GTM</span>
          </div>
        </div>

        <div className="tw-px-3 tw-py-4">
          <div className="tw-mb-4 tw-px-2">
            <h2 className="tw-mb-2 tw-text-xs tw-font-semibold tw-tracking-tight tw-text-muted-foreground">
              Settings
            </h2>
            <nav className="tw-space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedSection(item.id)}
                  className={`
                    tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-md tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-transition-colors
                    ${selectedSection === item.id
                      ? '!tw-bg-accent !tw-text-accent-foreground'
                      : 'tw-text-muted-foreground hover:tw-bg-accent/50 hover:tw-text-accent-foreground'
                    }
                  `}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="tw-px-2 tw-mt-8">
            <h2 className="tw-mb-2 tw-text-xs tw-font-semibold tw-tracking-tight tw-text-muted-foreground">
              About
            </h2>
            <div className="tw-rounded-md tw-border tw-border-border tw-p-3 tw-bg-card">
              <p className="tw-text-xs tw-text-muted-foreground">Lomen GTM Tool</p>
              <p className="tw-text-[10px] tw-text-muted-foreground tw-mt-1">Version 2.7.4</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="tw-flex-1 tw-flex tw-col">
        {/* Header */}
        <header className="tw-flex tw-h-14 tw-items-center tw-gap-4 tw-border-b tw-border-border tw-bg-background tw-px-6">
          <h1 className="tw-text-lg tw-font-semibold">
            {navItems.find(n => n.id === selectedSection)?.label}
          </h1>
        </header>

        <div className="tw-flex-1 tw-p-8 tw-max-w-4xl">
          {selectedSection === 'api-keys' && (
            <div className="tw-space-y-6">
              <div>
                <h3 className="tw-text-lg tw-font-medium">Configure credentials</h3>
                <p className="tw-text-sm tw-text-muted-foreground">
                  Manage your API keys for different AI providers.
                </p>
              </div>
              <div className="tw-border tw-border-border tw-rounded-lg tw-p-6 tw-bg-card">
                <APIKeysSection />
              </div>
            </div>
          )}

          {selectedSection === 'tone-prompts' && (
            <div className="tw-space-y-6">
              <div>
                <h3 className="tw-text-lg tw-font-medium">Tone Prompts</h3>
                <p className="tw-text-sm tw-text-muted-foreground">
                  Customize how the AI responds in different scenarios.
                </p>
              </div>
              <div className="tw-border tw-border-border tw-rounded-lg tw-p-6 tw-bg-card">
                <TonePromptsSection />
              </div>
            </div>
          )}

          {selectedSection === 'general' && (
            <div className="tw-space-y-6">
              <div>
                <h3 className="tw-text-lg tw-font-medium">General Settings</h3>
                <p className="tw-text-sm tw-text-muted-foreground">
                  Adjust general extension preferences.
                </p>
              </div>
              <div className="tw-border tw-border-border tw-rounded-lg tw-p-6 tw-bg-card">
                <GeneralSettingsSection />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
