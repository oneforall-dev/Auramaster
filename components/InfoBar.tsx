import React from 'react';
import { AlertTriangle, ArrowUpRight, Info, Sparkles } from 'lucide-react';
import type { SiteConfig } from '../services/siteConfigService';

interface Props {
  announcement: SiteConfig['announcement'];
}

export const InfoBar: React.FC<Props> = ({ announcement }) => {
  if (!announcement.enabled || !announcement.text) return null;

  const tone = announcement.tone === 'warning'
    ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
    : announcement.tone === 'success'
      ? 'border-lime-400/25 bg-lime-400/10 text-lime-100'
      : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100';
  const Icon = announcement.tone === 'warning' ? AlertTriangle : announcement.tone === 'success' ? Sparkles : Info;

  return (
    <aside className={`relative z-[80] shrink-0 border-b px-4 py-2.5 ${tone}`} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs font-semibold sm:text-sm">
        <Icon size={15} className="shrink-0" />
        <span>{announcement.text}</span>
        {announcement.linkLabel && announcement.linkUrl && (
          <a href={announcement.linkUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-black underline decoration-current/40 underline-offset-4 hover:decoration-current">
            {announcement.linkLabel}<ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </aside>
  );
};
