import { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Header } from '../components/Header';
import { Page } from '../components/Page';
import { ListItem } from '../components/ListItem';
import { Dialog, type DialogAction } from '../components/Dialog';
import { FocusableButton } from '../components/FocusableButton';

type Settings = {
  subtitleSize: number;
  subtitleColor: 'white' | 'yellow';
  startFullscreen: boolean;
};

const SIZES = [30, 40, 50, 60, 70, 80];
const COLORS: Array<'white' | 'yellow'> = ['white', 'yellow'];

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export function Settings() {
  const [settings, setSettings] = useState<Settings>({
    subtitleSize: 50,
    subtitleColor: 'white',
    startFullscreen: false,
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

  return (
    <Page header={<Header title="Settings" />}>
      <div className="flex flex-col gap-4">
        <ListItem
          label="Subtitle size"
          hint={`${settings.subtitleSize}`}
          onSelect={() => setShowSubtitleSizeDialog(true)}
        />
        <ListItem
          label="Subtitle color"
          hint={titleCase(settings.subtitleColor)}
          onSelect={() => setShowSubtitleColorDialog(true)}
        />
        <ListItem
          label="Startup mode"
          hint={settings.startFullscreen ? 'Fullscreen' : 'Normal'}
          onSelect={() =>
            saveSettings({
              ...settings,
              startFullscreen: !settings.startFullscreen,
            })
          }
        />
      </div>

      {showSubtitleSizeDialog && (
        <OptionDialog
          title="Subtitle size"
          options={SIZES}
          current={settings.subtitleSize}
          format={(size) => `${size}`}
          onSave={(size) => {
            saveSettings({ ...settings, subtitleSize: size });
            setShowSubtitleSizeDialog(false);
          }}
          onClose={() => setShowSubtitleSizeDialog(false)}
        />
      )}

      {showSubtitleColorDialog && (
        <OptionDialog
          title="Subtitle color"
          options={COLORS}
          current={settings.subtitleColor}
          format={titleCase}
          onSave={(color) => {
            saveSettings({ ...settings, subtitleColor: color });
            setShowSubtitleColorDialog(false);
          }}
          onClose={() => setShowSubtitleColorDialog(false)}
        />
      )}
    </Page>
  );
}

/**
 * A single-choice picker on top of the shared Dialog, so focus is trapped while
 * it's open and it carries Back/OK actions like the add-source flow. Choosing an
 * option only marks it pending (highlighted); OK commits it, Back discards. The
 * current value is focused on open so the remote starts where the setting is.
 */
function OptionDialog<T extends string | number>({
  title,
  options,
  current,
  format,
  onSave,
  onClose,
}: {
  title: string;
  options: T[];
  current: T;
  format: (option: T) => string;
  onSave: (option: T) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<T>(current);

  useEffect(() => {
    setFocus(`option-${current}`);
  }, [current]);

  const actions: DialogAction[] = [
    { label: 'Back', icon: <ArrowLeft className="h-5 w-5" />, onPress: onClose },
    {
      label: 'OK',
      icon: <Check className="h-5 w-5" />,
      onPress: () => onSave(pending),
    },
  ];

  return (
    <Dialog title={title} onClose={onClose} actions={actions}>
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <FocusableButton
            key={option}
            focusKey={`option-${option}`}
            label={format(option)}
            selected={option === pending}
            onPress={() => setPending(option)}
          />
        ))}
      </div>
    </Dialog>
  );
}
