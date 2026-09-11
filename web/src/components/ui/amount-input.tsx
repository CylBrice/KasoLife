import { Minus, Plus } from 'lucide-react';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AmountInput({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  label,
  placeholder,
  disabled = false,
  className = '',
}: AmountInputProps) {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? min : Number(e.target.value);
    if (!isNaN(val) && val >= min && val <= max) {
      onChange(val);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm font-medium text-cream">{label}</label>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className="rounded-xl border border-brick/40 bg-brick/10 p-2 hover:bg-brick/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Diminuer"
        >
          <Minus size={16} className="text-brick" />
        </button>

        <input
          type="number"
          value={value}
          onChange={handleDirectInput}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className="w-20 rounded-xl border border-ink-line bg-ink-surface px-3 py-2 text-center text-sm text-cream placeholder:text-sage-muted focus:outline-none focus:ring-2 focus:ring-brick/50 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="rounded-xl border border-brick/40 bg-brick/10 p-2 hover:bg-brick/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Augmenter"
        >
          <Plus size={16} className="text-brick" />
        </button>
      </div>
      {max && (
        <p className="text-xs text-sage-muted">
          {min} - {max}
        </p>
      )}
    </div>
  );
}
