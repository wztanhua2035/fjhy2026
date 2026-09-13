import {uiTokens} from '../../../packages/client-runtime/ui-design-tokens.js';
import './showcase.css';
for(const [name,value] of Object.entries(uiTokens.colors))document.documentElement.style.setProperty(`--ui-${name}`,value);
