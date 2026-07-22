import type { FC, ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export const PageHeader: FC<PageHeaderProps> = ({ title, description, children }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children && <div>{children}</div>}
    </div>
  );
};
