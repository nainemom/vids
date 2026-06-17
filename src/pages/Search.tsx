import { Header } from '../components/Header';
import { Page } from '../components/Page';
import { ListItem } from '../components/ListItem';

// Placeholder content — real search lands later.
export function Search() {
  return (
    <Page header={<Header title="Search" />}>
      <ListItem label="Search your library…" />
    </Page>
  );
}
