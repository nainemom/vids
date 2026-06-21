import { type ReactNode } from 'react';
import { Header } from './Header';
import { Page } from './Page';

type DetailViewProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
};

/**
 * Shared body for the drill-down pages (series → groups → videos, movie →
 * videos). Renders its own Header — with a Back button — above the scrolling
 * list (via Page), so the header stays visible while the list scrolls. Page
 * lands focus on the first row (↑ reaches Back). The remote's Back button and
 * keyboard Escape / Backspace navigate up too — handled globally for every page
 * by useRemoteKeys (App.tsx), which walks up the same route this Back button does.
 */
export function DetailView({
  title,
  subtitle,
  onBack,
  children,
}: DetailViewProps) {
  return (
    <Page header={<Header back={onBack} title={title} subtitle={subtitle} />}>
      <div className="flex flex-col gap-3">{children}</div>
    </Page>
  );
}
