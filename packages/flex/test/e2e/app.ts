import { Application } from 'pixi.js';
import { mount, h, VGroup, Label } from '../../src/index';

(async () => {
  const app = new Application();
  await app.init({ 
    width: 400, 
    height: 400, 
    backgroundColor: 0x1099bb 
  });
  document.body.appendChild(app.canvas);

  mount(() => h(VGroup, { gap: 20, padding: 20 }, 
     h(Label, { text: 'TEST', style: { fill: 'white', fontSize: 30 } }),
     h(Label, { text: 'FLEX', style: { fill: 'yellow', fontSize: 20 } })
  ), app.stage);
  
  (window as any).isReady = true;
})();
