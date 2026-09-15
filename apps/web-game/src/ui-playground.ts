import {uiTokens} from '../../../packages/client-runtime/ui-design-tokens.js';
import './design-system.css';
import './web-polish.css';
import './showcase.css';
import './showcase-overrides.css';
for(const [name,value] of Object.entries(uiTokens.colors))document.documentElement.style.setProperty(`--ui-${name}`,value);
