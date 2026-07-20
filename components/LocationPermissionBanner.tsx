'use client';

import { useEffect, useState } from 'react';

type Browser = 'chrome' | 'safari' | 'firefox' | 'other';

const INSTRUCTIONS: Record<Browser, string[]> = {
  chrome: [
    'Tap the lock/tune icon left of the address bar',
    'Open "Site settings" (or "Permissions")',
    'Set Location to "Allow", then reload the page',
  ],
  safari: [
    'Open Settings → Apps → Safari → Location (iOS), or Safari → Settings → Websites → Location (Mac)',
    'Set this site to "Allow"',
    'Reload the page',
  ],
  firefox: [
    'Tap the shield/lock icon in the address bar',
    'Clear the blocked Location permission',
    'Reload the page and choose "Allow" when prompted',
  ],
  other: [
    'Open your browser settings',
    'Find site permissions for this page and allow Location',
    'Reload the page',
  ],
};

const LABEL: Record<Browser, string> = {
  chrome: 'Chrome',
  safari: 'Safari',
  firefox: 'Firefox',
  other: 'your browser',
};

function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/firefox/i.test(ua)) return 'firefox';
  // Chrome must be tested before Safari — Chrome UA contains "Safari".
  if (/chrome|crios/i.test(ua)) return 'chrome';
  if (/safari/i.test(ua)) return 'safari';
  return 'other';
}

export default function LocationPermissionBanner({ onRetry }: { onRetry: () => void }) {
  // Detect in an effect to keep server/client render output identical.
  const [browser, setBrowser] = useState<Browser>('other');
  useEffect(() => setBrowser(detectBrowser()), []);

  return (
    <div className="rounded-lg border border-default bg-surface p-4 shadow-md">
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mt-0.5 h-5 w-5 shrink-0 text-tertiary"
          aria-hidden="true"
        >
          <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <div>
          <p className="text-[14px] font-semibold leading-[20px] text-primary">
            Location access is blocked
          </p>
          <p className="mt-1 text-[14px] leading-[20px] text-secondary">
            Chargewise needs your position to find chargers around you. Your
            location never leaves your browser. To re-enable it in {LABEL[browser]}:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-[20px] text-secondary">
            {INSTRUCTIONS[browser].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            onClick={onRetry}
            className="mt-4 h-8 rounded-md bg-accent px-4 text-[13px] font-semibold leading-[18px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
