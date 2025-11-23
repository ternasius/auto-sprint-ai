import React from 'react';
import '@atlaskit/css-reset';
import { SprintAnalysisPage } from './components/SprintAnalysisPage';
import { IssuePanel } from './components/IssuePanel';

interface AppProps {
  context: any;
}

const App: React.FC<AppProps> = ({ context }) => {
  // Determine which component to render based on module key
  const moduleKey = context?.extension?.module?.key;

  if (moduleKey === 'sprint-metrics-panel') {
    return <IssuePanel context={context} />;
  }

  // Default to Sprint Analysis Page
  return <SprintAnalysisPage context={context} />;
};

export default App;
