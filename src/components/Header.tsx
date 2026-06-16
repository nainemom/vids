type HeaderProps = {
  /** Title of the currently highlighted card, or undefined for the default. */
  title?: string;
};

/**
 * Top bar: shows the highlighted card's title (falling back to "Vids") on the
 * left and the window controls on the right. The controls call the bridge
 * exposed by electron/preload.ts.
 */
export function Header({ title }: HeaderProps) {

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-6 py-4 pr-6 pl-4"
    >
      <h1 className="truncate text-3xl font-bold text-white">
        {title ?? 'Vids'}
      </h1>
    </header>
  );
}
