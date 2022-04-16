import WebViewer from '@pdftron/webviewer';
import { useRef, useEffect } from 'react';
import './App.css';

function App() {
  const viewer = useRef(null);

  useEffect(() => {
    WebViewer(
      {
        path: '/lib',
        fullAPI: true,
        enableRedaction: true,
        initialDoc: 'http://localhost:9000/files/legal-contract.pdf',
      },
      viewer.current
    ).then((instance) => {
      const { documentViewer, annotationManager } = instance.Core;

      documentViewer.addEventListener('documentLoaded', async () => {
        const res = await fetch('http://localhost:9000/getRedaction/legal-contract.pdf');
        const data = await res.json();
        const { xfdf } = data;
        annotationManager.importAnnotations(xfdf);
      });
    });
  }, []);

  return <div className='App' ref={viewer}></div>;
}

export default App;
