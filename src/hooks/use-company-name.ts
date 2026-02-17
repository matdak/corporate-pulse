import { useState, useCallback } from "react";

const STORAGE_KEY = "social-listener-company-name";
const DEFAULT_NAME = "Corporate";

export function useCompanyName() {
  const [companyName, setCompanyNameState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_NAME;
    } catch {
      return DEFAULT_NAME;
    }
  });

  const setCompanyName = useCallback((name: string) => {
    const trimmed = name.trim() || DEFAULT_NAME;
    setCompanyNameState(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {}
  }, []);

  return { companyName, setCompanyName };
}

export function getCompanyName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}
