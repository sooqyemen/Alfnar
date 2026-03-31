'use client';

// شريط اختيارات (Chips)
// - يدعم التمرير الأفقي في الجوال
// - يعطّل الاختيارات إذا كان disabled
// - بدون <style jsx> لتقليل فلاش/تأخر التنسيق

export default function ChipsRow({ value, options = [], onChange, disabled = false }) {
  return (
    <div
      aria-disabled={disabled ? 'true' : 'false'}
      style={{
        width: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          whiteSpace: 'nowrap',
        }}
      >
        {options.map((opt) => {
          const active = value === opt.value;

          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                if (disabled) return;
                onChange?.(active ? '' : opt.value);
              }}
              disabled={disabled}
              style={{
                flex: '0 0 auto',
                border: active
                  ? '1px solid rgba(214,179,91,0.55)'
                  : '1px solid var(--border)',
                background: active
                  ? 'rgba(214,179,91,0.22)'
                  : '#ffffff',
                color: active ? '#1f2937' : 'var(--text)',
                padding: '8px 12px',
                borderRadius: 999,
                fontWeight: 900,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'transform 120ms ease, background 120ms ease, border-color 120ms ease',
                lineHeight: 1.2,
                fontSize: 14,
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}
              title={opt.label}
              aria-pressed={active ? 'true' : 'false'}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
