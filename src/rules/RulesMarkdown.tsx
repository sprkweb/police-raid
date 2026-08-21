import Markdown from 'react-markdown';

export function RulesMarkdown({ source }: { source: string }) {
  return <Markdown>{source}</Markdown>;
}
