"use client";

import { createContext, useContext, type ReactNode } from "react";

const DemoContext = createContext(false);

export function DemoProvider({ children }: { children: ReactNode }) {
  return <DemoContext.Provider value>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}
