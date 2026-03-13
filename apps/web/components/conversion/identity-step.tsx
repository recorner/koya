'use client';

import { useState, useCallback } from 'react';
import { ArrowRight, User, FileText, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { conversionApi } from '@/lib/api/conversion';

export function IdentityStep({
  sessionId,
  onComplete,
}: {
  sessionId: string;
  onComplete: (guestRef: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: '',
    countryCode: 'KE',
    documentType: 'NATIONAL_ID',
    documentNumber: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setError('');
  };

  const isValid =
    form.fullName.trim().length >= 3 &&
    form.documentNumber.trim().length >= 5 &&
    form.phone.trim().length >= 9;

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');

    try {
      const result = await conversionApi.submitIdentity(sessionId, {
        fullName: form.fullName.trim(),
        countryCode: form.countryCode,
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });

      if (!result.compliancePassed) {
        setError(result.reason ?? 'Compliance check failed');
        return;
      }

      onComplete(result.guestRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identity submission failed');
    } finally {
      setLoading(false);
    }
  }, [isValid, sessionId, form, onComplete]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
        Verify your identity
      </h2>
      <p className="mt-1.5 text-sm text-white/50">
        Required for guest conversions. Your data is encrypted and never shared.
      </p>

      <div className="mt-5 space-y-3">
        {/* Full Name */}
        <FieldGroup icon={<User size={14} />} label="Full Name">
          <input
            type="text"
            placeholder="John Mwangi Kamau"
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            className="w-full bg-transparent font-body text-sm text-white outline-none placeholder:text-white/25"
          />
        </FieldGroup>

        {/* Document */}
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup icon={<FileText size={14} />} label="Document Type">
            <select
              value={form.documentType}
              onChange={(e) => updateField('documentType', e.target.value)}
              className="w-full bg-transparent font-body text-sm text-white outline-none"
            >
              <option value="NATIONAL_ID" className="bg-[#0F0F10] text-white">
                National ID
              </option>
              <option value="PASSPORT" className="bg-[#0F0F10] text-white">
                Passport
              </option>
              <option value="ALIEN_ID" className="bg-[#0F0F10] text-white">
                Alien ID
              </option>
              <option value="MILITARY_ID" className="bg-[#0F0F10] text-white">
                Military ID
              </option>
            </select>
          </FieldGroup>

          <FieldGroup icon={<FileText size={14} />} label="Document Number">
            <input
              type="text"
              placeholder="12345678"
              value={form.documentNumber}
              onChange={(e) => updateField('documentNumber', e.target.value)}
              className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/25"
            />
          </FieldGroup>
        </div>

        {/* Phone */}
        <FieldGroup icon={<Phone size={14} />} label="M-Pesa Phone Number">
          <input
            type="tel"
            placeholder="0712345678"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/25"
          />
        </FieldGroup>

        {/* Email (optional) */}
        <FieldGroup icon={null} label="Email (optional)">
          <input
            type="email"
            placeholder="you@email.com"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="w-full bg-transparent font-body text-sm text-white outline-none placeholder:text-white/25"
          />
        </FieldGroup>
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-red">{error}</p>
      )}

      <Button
        size="lg"
        className="mt-5 h-11 w-full text-sm font-medium"
        disabled={!isValid || loading}
        onClick={handleSubmit}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-vault-black/30 border-t-vault-black" />
            Verifying…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Verify & Continue <ArrowRight size={16} />
          </span>
        )}
      </Button>
    </div>
  );
}

function FieldGroup({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.04] p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon && <span className="text-white/30">{icon}</span>}
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}
