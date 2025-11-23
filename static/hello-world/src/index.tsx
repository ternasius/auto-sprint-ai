import React from 'react';
import ReactDOM from 'react-dom';
import { view } from '@forge/bridge';
import App from './App';

// Get context from Forge and render the app
view.getContext().then((context) => {
  ReactDOM.render(
    <React.StrictMode>
      <App context={context} />
    </React.StrictMode>,
    document.getElementById('root')
  );
});
