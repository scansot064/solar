import * as astro from './astro.js';
import * as earthView from './earthView.js';
import * as i18n from './i18n.js';
import * as template from './template.js';
import * as pdf from './pdf.js';
import {createApp} from '../app.js';

const state={
 events:[],
 solar:{},
 selectedIndex:0,
 cities:null,
 earthView:'sol'
};

const solarApp=createApp({state,modules:{astro,earthView,i18n,template,pdf}});

window.solarApp=solarApp;
window.runSolar=solarApp.run;
window.setSolarLanguage=solarApp.switchLanguage;
window.generateSolarPdf=solarApp.generatePDF;
