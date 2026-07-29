import type { ReactNode } from "react";

export default function SidebarPanel({ children }: { children: ReactNode }) {
  /*
  Small Container for the Desktop Extended Sidebar
  */
  return (
    <div
      className={`h-full bg-white dark:bg-bg_secondary_dark
              rounded-xl shadow-md
              overflow-hidden`}
    >
      {children}
    </div>
  );
}
