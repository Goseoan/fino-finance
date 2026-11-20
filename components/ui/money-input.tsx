"use client";
import { forwardRef, useRef, type InputHTMLAttributes } from "react";
import { formatMoneyInput, moneyDigits, moneyCaret } from "@/lib/money-input";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue"
> & {
  value?: string | number | null;
  defaultValue?: string | number | null;
};
/** Display separators while existing change/blur handlers receive unformatted amounts. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(
  function MoneyInput(
    { value, defaultValue, onChange, onBlur, onKeyDown, ...props },
    ref,
  ) {
    const lastAccepted = useRef(formatMoneyInput(value ?? defaultValue));
    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={value === undefined ? undefined : formatMoneyInput(value)}
        defaultValue={
          defaultValue === undefined
            ? undefined
            : formatMoneyInput(defaultValue)
        }
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          const el = event.currentTarget;
          const cursor = el.selectionStart;
          if (cursor == null || cursor !== el.selectionEnd) return;
          if (event.key === "Backspace" && el.value[cursor - 1] === ",")
            el.setSelectionRange(cursor - 1, cursor - 1);
          if (event.key === "Delete" && el.value[cursor] === ",")
            el.setSelectionRange(cursor + 1, cursor + 1);
        }}
        onChange={(event) => {
          const el = event.currentTarget;
          const before = el.value;
          const count = before
            .slice(0, el.selectionStart ?? before.length)
            .replace(/\D/g, "").length;
          const raw = moneyDigits(before);
          if (!/^\d*$/.test(raw)) {
            el.value =
              value === undefined
                ? lastAccepted.current
                : formatMoneyInput(value);
            return;
          }
          el.value = raw;
          onChange?.(event);
          el.value = formatMoneyInput(raw);
          lastAccepted.current = el.value;
          const caret = moneyCaret(el.value, count);
          el.setSelectionRange(caret, caret);
        }}
        onBlur={(event) => {
          const el = event.currentTarget;
          el.value = moneyDigits(el.value);
          onBlur?.(event);
          el.value = formatMoneyInput(el.value);
        }}
      />
    );
  },
);
