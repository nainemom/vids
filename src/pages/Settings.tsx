import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Page } from '../components/Page';
import { ListItem } from '../components/ListItem';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

type Settings = {
  subtitleSize: number;
  subtitleColor: 'white' | 'yellow';
};

export function Settings() {
  const [settings, setSettings] = useState<Settings>({
    subtitleSize: 50,
    subtitleColor: 'white',
  });
  const [showSubtitleSizeDialog, setShowSubtitleSizeDialog] = useState(false);
  const [showSubtitleColorDialog, setShowSubtitleColorDialog] = useState(false);

  useEffect(() => {
    window.app?.readSettings().then((s: Settings) => {
      setSettings(s);
    });
  }, []);

  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    await window.app?.writeSettings(newSettings);
  };

  const handleSubtitleSizeSelect = () => {
    setShowSubtitleSizeDialog(true);
  };

  const handleSubtitleColorSelect = () => {
    setShowSubtitleColorDialog(true);
  };

  const setSizeOption = async (size: number) => {
    await saveSettings({ ...settings, subtitleSize: size });
    setShowSubtitleSizeDialog(false);
  };

  const setColorOption = async (color: 'white' | 'yellow') => {
    await saveSettings({ ...settings, subtitleColor: color });
    setShowSubtitleColorDialog(false);
  };

  return (
    <Page header={<Header title="Settings" />}>
      <div className="flex flex-col gap-4">
        <ListItem
          label="Subtitle size"
          hint={`${settings.subtitleSize}`}
          onSelect={handleSubtitleSizeSelect}
        />
        <ListItem
          label="Subtitle color"
          hint={settings.subtitleColor}
          onSelect={handleSubtitleColorSelect}
        />
      </div>

      {showSubtitleSizeDialog && (
        <SubtitleSizeDialog
          currentSize={settings.subtitleSize}
          onSelect={setSizeOption}
        />
      )}

      {showSubtitleColorDialog && (
        <SubtitleColorDialog
          currentColor={settings.subtitleColor}
          onSelect={setColorOption}
        />
      )}
    </Page>
  );
}

function SubtitleSizeDialog({
  currentSize,
  onSelect,
}: {
  currentSize: number;
  onSelect: (size: number) => void;
}) {
  const sizes = [30, 40, 50, 60, 70, 80];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="rounded-2xl bg-neutral-900 p-8">
        <h2 className="mb-6 text-2xl font-bold text-white">Subtitle Size</h2>
        <div className="flex flex-col gap-3">
          {sizes.map((size) => (
            <SizeOption
              key={size}
              size={size}
              selected={size === currentSize}
              onSelect={() => onSelect(size)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SizeOption({
  size,
  selected,
  onSelect,
}: {
  size: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={[
        'rounded-lg px-4 py-3 cursor-pointer transition-all duration-150',
        selected
          ? 'bg-blue-600 text-white'
          : focused
            ? 'bg-white text-black'
            : 'bg-neutral-800 text-neutral-200',
      ].join(' ')}
    >
      {size}
    </div>
  );
}

function SubtitleColorDialog({
  currentColor,
  onSelect,
}: {
  currentColor: 'white' | 'yellow';
  onSelect: (color: 'white' | 'yellow') => void;
}) {
  const colors: Array<'white' | 'yellow'> = ['white', 'yellow'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="rounded-2xl bg-neutral-900 p-8">
        <h2 className="mb-6 text-2xl font-bold text-white">Subtitle Color</h2>
        <div className="flex flex-col gap-3">
          {colors.map((color) => (
            <ColorOption
              key={color}
              color={color}
              selected={color === currentColor}
              onSelect={() => onSelect(color)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorOption({
  color,
  selected,
  onSelect,
}: {
  color: 'white' | 'yellow';
  selected: boolean;
  onSelect: () => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={[
        'rounded-lg px-4 py-3 cursor-pointer transition-all duration-150',
        selected
          ? 'bg-blue-600 text-white'
          : focused
            ? 'bg-white text-black'
            : 'bg-neutral-800 text-neutral-200',
      ].join(' ')}
    >
      {color.charAt(0).toUpperCase() + color.slice(1)}
    </div>
  );
}
