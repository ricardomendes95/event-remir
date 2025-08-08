"use client";

import React from "react";
import { Input } from "antd";

interface MoneyInputProps {
  value?: number;
  onChange?: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = "R$ 0,00",
  disabled = false,
  className,
}) => {
  const formatToDisplay = (num: number): string => {
    if (isNaN(num) || num === 0) return "";

    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const parseFromDisplay = (str: string): number => {
    if (!str) return 0;

    // Remove tudo exceto números
    const numbers = str.replace(/\D/g, "");

    if (!numbers) return 0;

    // Converte centavos para reais (divide por 100)
    return parseFloat(numbers) / 100;
  };

  const [displayValue, setDisplayValue] = React.useState<string>(() => {
    return value ? formatToDisplay(value) : "";
  });

  React.useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(value > 0 ? formatToDisplay(value) : "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Se o campo foi limpo, resetar
    if (!inputValue) {
      setDisplayValue("");
      onChange?.(0);
      return;
    }

    // Parse o valor numérico
    const numericValue = parseFromDisplay(inputValue);

    // Formatar para exibição
    const formatted = formatToDisplay(numericValue);

    setDisplayValue(formatted);
    onChange?.(numericValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permitir apenas números, backspace, delete, tab, escape, enter, home, end, setas
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "Home",
      "End",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ];

    const isNumber = /^[0-9]$/.test(e.key);
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlA = e.ctrlKey && e.key === "a";
    const isCtrlC = e.ctrlKey && e.key === "c";
    const isCtrlV = e.ctrlKey && e.key === "v";
    const isCtrlX = e.ctrlKey && e.key === "x";
    const isCtrlZ = e.ctrlKey && e.key === "z";

    if (
      !isNumber &&
      !isAllowedKey &&
      !isCtrlA &&
      !isCtrlC &&
      !isCtrlV &&
      !isCtrlX &&
      !isCtrlZ
    ) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pastedText = e.clipboardData.getData("text");
    const numericValue = parseFromDisplay(pastedText);

    if (!isNaN(numericValue)) {
      const formatted = formatToDisplay(numericValue);
      setDisplayValue(formatted);
      onChange?.(numericValue);
    }
  };

  return (
    <Input
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
};
