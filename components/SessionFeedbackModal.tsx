'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useBadges, useEmspCatalogue } from '@/hooks/useBadges';
import { capture } from '@/lib/posthog';

export interface SessionPrefill {
  station_id?: string;
  recommendation_id?: string | null;
  emsp_plan_id?: string;
}

interface SessionFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  prefill?: SessionPrefill;
  /** Nearby stations to choose from when no station is prefilled. */
  stations?: { id: string; name: string }[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const fieldClasses =
  'h-10 w-full rounded-md border border-default bg-surface px-3 text-[14px] leading-[20px] text-primary outline-none transition-shadow duration-fast ease-amp placeholder:text-tertiary focus-visible:shadow-focus';
const labelClasses = 'mb-1 block text-[13px] leading-[18px] text-secondary';

export default function SessionFeedbackModal({
  open,
  onClose,
  prefill,
  stations = [],
}: SessionFeedbackModalProps) {
  const { badges } = useBadges();
  const { planById } = useEmspCatalogue();

  const [stationId, setStationId] = useState('');
  const [planId, setPlanId] = useState('');
  const [cost, setCost] = useState('');
  const [kwh, setKwh] = useState('');
  const [date, setDate] = useState(today());
  const [phase, setPhase] = useState<'form' | 'submitting' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);

  // Re-initialise from the prefill each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStationId(prefill?.station_id ?? '');
    setPlanId(prefill?.emsp_plan_id ?? '');
    setCost('');
    setKwh('');
    setDate(today());
    setPhase('form');
    setError(null);
  }, [open, prefill]);

  if (!open) return null;

  const costNum = Number(cost);
  const kwhNum = kwh === '' ? null : Number(kwh);
  const valid =
    stationId !== '' &&
    planId !== '' &&
    cost !== '' &&
    costNum > 0 &&
    costNum <= 500 &&
    (kwhNum === null || (kwhNum > 0 && kwhNum <= 200)) &&
    date <= today();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || phase === 'submitting') return;
    setError(null);
    setPhase('submitting');
    try {
      const res = await fetch('/api/charge-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation_id: prefill?.recommendation_id ?? undefined,
          station_id: stationId,
          emsp_plan_id: planId,
          reported_cost_eur: costNum,
          reported_kwh: kwhNum ?? undefined,
          session_date: date,
        }),
      });
      if (res.status === 201 || res.ok) {
        // NEVER include cost or kWh values in analytics (spec §10.3).
        capture('session_feedback_submitted', {
          station_id: stationId,
          emsp_plan_id: planId,
          had_recommendation: !!prefill?.recommendation_id,
          has_kwh: kwhNum !== null,
        });
        setPhase('success');
        return;
      }
      setError('Could not save your session. Please check the values and try again.');
      setPhase('form');
    } catch {
      setError('Network error. Please try again.');
      setPhase('form');
    }
  };

  const stationName = stations.find((s) => s.id === stationId)?.name;

  return (
    <div
      className="amp-overlay fixed inset-0 z-[1300] flex items-end justify-center bg-[var(--amp-surface-overlay)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Log a charging session"
      onClick={onClose}
    >
      <div
        className="amp-modal w-full max-w-md rounded-xl border border-default bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'success' ? (
          <div className="py-6 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="mx-auto h-8 w-8 text-accent"
              aria-hidden="true"
            >
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
            <p className="mt-2 text-[16px] font-semibold leading-[24px] text-primary">
              Thanks! Every report makes prices sharper.
            </p>
            <button
              onClick={onClose}
              className="mt-6 h-11 rounded-md bg-accent px-6 text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 className="font-display text-[20px] font-semibold leading-[28px] text-primary">
              Log your charging session
            </h2>
            <p className="mt-1 text-[14px] leading-[20px] text-secondary">
              Your report helps everyone see real prices.
            </p>

            <div className="mt-4 space-y-4">
              {/* Station: read-only if prefilled, otherwise pick from nearby */}
              <div>
                <label className={labelClasses}>Station</label>
                {prefill?.station_id ? (
                  <p className="flex h-10 items-center rounded-md border border-default bg-subtle px-3 text-[14px] leading-[20px] text-secondary">
                    {stationName ?? prefill.station_id}
                  </p>
                ) : stations.length > 0 ? (
                  <select
                    required
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    className={fieldClasses}
                  >
                    <option value="">Select a nearby station…</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    placeholder="Station ID (e.g. FR*CM*E12345)"
                    className={fieldClasses}
                  />
                )}
              </div>

              <div>
                <label htmlFor="sf-plan" className={labelClasses}>
                  Badge used
                </label>
                <select
                  id="sf-plan"
                  required
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className={fieldClasses}
                >
                  <option value="">Select your badge…</option>
                  {/* Prefilled recommendation plan may not be a badge yet */}
                  {prefill?.emsp_plan_id && !badges.some((b) => b.plan_id === prefill.emsp_plan_id) && (
                    <option value={prefill.emsp_plan_id}>
                      {planById.get(prefill.emsp_plan_id)?.display_name ?? prefill.emsp_plan_id}
                    </option>
                  )}
                  {badges.map((b) => (
                    <option key={b.id} value={b.plan_id}>
                      {planById.get(b.plan_id)?.display_name ?? b.plan_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sf-cost" className={labelClasses}>
                    Cost (€) *
                  </label>
                  <input
                    id="sf-cost"
                    type="number"
                    required
                    min="0.01"
                    max="500"
                    step="0.01"
                    inputMode="decimal"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className={`${fieldClasses} font-mono`}
                  />
                </div>
                <div>
                  <label htmlFor="sf-kwh" className={labelClasses}>
                    kWh (optional)
                  </label>
                  <input
                    id="sf-kwh"
                    type="number"
                    min="0.1"
                    max="200"
                    step="0.1"
                    inputMode="decimal"
                    value={kwh}
                    onChange={(e) => setKwh(e.target.value)}
                    className={`${fieldClasses} font-mono`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sf-date" className={labelClasses}>
                  Date
                </label>
                <input
                  id="sf-date"
                  type="date"
                  required
                  max={today()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${fieldClasses} font-mono`}
                />
              </div>
            </div>

            {error && <p className="mt-3 text-[13px] leading-[18px] text-status-danger">{error}</p>}

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 rounded-md border border-default bg-surface text-[14px] font-medium leading-[20px] text-primary transition-colors duration-fast ease-amp hover:bg-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || phase === 'submitting'}
                className="h-11 flex-1 rounded-md bg-accent text-[14px] font-semibold leading-[20px] text-on-accent transition-colors duration-fast ease-amp hover:bg-accent-hover active:bg-accent-active disabled:opacity-50"
              >
                {phase === 'submitting' ? 'Saving…' : 'Save session'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
