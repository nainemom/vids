import { useEffect, type ReactNode } from 'react';
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
 * lands focus on the first row (↑ reaches Back); the remote's Back / keyboard
 * Escape / Backspace also navigates up.
 */
export function DetailView({
  title,
  subtitle,
  onBack,
  children,
}: DetailViewProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <Page header={<Header back={onBack} title={title} subtitle={subtitle} />}>
      <div className="flex flex-col gap-3">{children}</div>
    </Page>
  );
}
