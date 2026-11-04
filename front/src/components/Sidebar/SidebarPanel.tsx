import type { ReactNode } from "react";

export default function SidebarPanel({ children }: { children: ReactNode }) {
  /*
  Small Container for the Desktop Extended Sidebar
  */
  return (
    <div
      className={`h-full bg-base-100
              rounded-xl shadow-md
              overflow-hidden`}
    >
      {children}
    </div>
  );
}
