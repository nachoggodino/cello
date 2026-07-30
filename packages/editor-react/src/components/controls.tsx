import { useEffect, useRef, useState } from "react";
import { EditorIcon } from "../icons.js";

export function IconButton({
  className,
  disabled,
  icon,
  label,
  onClick
}: {
  className?: string;
  disabled?: boolean;
  icon: Parameters<typeof EditorIcon>[0]["name"];
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={["celloVisualButton", "celloVisualIconButton", className].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <EditorIcon name={icon} />
    </button>
  );
}

export function IconTextButton({
  active,
  disabled,
  label,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "celloVisualButton",
        "celloVisualTextStyleButton",
        active ? "active" : ""
      ].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export interface ValueMenuOption {
  label: string;
  value: string;
  className?: string;
}

export function ValueMenu({
  ariaLabel,
  buttonClassName,
  customPlaceholder,
  disabled,
  displayValue,
  options,
  value,
  onChange
}: {
  ariaLabel: string;
  buttonClassName?: string;
  customPlaceholder?: string;
  disabled?: boolean;
  displayValue: string;
  options: ValueMenuOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeMenu = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [open]);

  const commitCustom = () => {
    if (disabled) {
      return;
    }
    const nextValue = customValue.trim();
    if (nextValue) {
      onChange(nextValue);
      setCustomValue("");
      setOpen(false);
    }
  };

  return (
    <div className="celloVisualValueMenu" ref={ref}>
      <button
        type="button"
        className={["celloVisualButton", buttonClassName].filter(Boolean).join(" ")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {displayValue}
      </button>
      {open ? (
        <div className="celloVisualValueOptions" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              className={[
                option.className,
                value === option.value ? "active" : ""
              ].filter(Boolean).join(" ")}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
          {customPlaceholder ? (
            <input
              aria-label={customPlaceholder}
              value={customValue}
              placeholder={customPlaceholder}
              onChange={(event) => setCustomValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitCustom();
                }
              }}
              onBlur={commitCustom}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
