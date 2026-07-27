"use client";

import { useState } from "react";

type Props = {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  labelRightSlot?: React.ReactNode;
};

export function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
  labelRightSlot,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      {labelRightSlot ? (
        <div className="field-label-row">
          <label htmlFor={id}>{label}</label>
          {labelRightSlot}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <div className="field-input-wrap">
        <input
          type={visible ? "text" : "password"}
          id={id}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path
                d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.77 9.77 0 0112 4c5 0 9.27 3.11 11 7.5a11.83 11.83 0 01-3.17 4.42M6.35 6.35C4.06 7.9 2.3 10.02 1 11.5 2.73 15.89 7 19 12 19a9.9 9.9 0 004.24-.94"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path
                d="M1 11.5C2.73 7.11 7 4 12 4s9.27 3.11 11 7.5C21.27 15.89 17 19 12 19s-9.27-3.11-11-7.5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="11.5" r="3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
