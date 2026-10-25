import { store } from './store.js';
import { isConfigured } from './firebase-config.js';
import { onAuth } from './auth.js';
import { watchUserDoc } from './services/household-service.js';
import { connect } from './services/data-service.js';
import { h, toast } from './ui/dom.js';
import { renderAuth, renderGate } from './ui/auth-ui.js';
import { renderDashboard } from './ui/dashboard-ui.js';
import { renderPlanner } from './ui/planner-ui.js';
import { renderRecipes } from './ui/recipes-ui.js';
import { renderHousehold } from './ui/household-ui.js';
import { renderShopping } from './ui/shopping-ui.js';
import { renderInventory } from './ui/inventory-ui.js';
import { renderHistory } from './ui/history-ui.js';

const routes = { home: renderDashboard, planner: renderPlanner, recipes: renderRecipes, shopping: renderShopping, inventory: renderInventory, history: renderHistory, household: renderHousehold };
const view = document.getElementById('view');
const syncEl = document.getElementById('sync');
let user = null, hid = null, authReady = false, stopUser = () => {};
const say = (cls, text) => view.replaceChildren(h('p', { class: cls }, text));

function render() {
  document.body.classList.toggle('gated', !(user && hid));
  if (!isConfigured) return say('empty', 'لم يتم ضبط Firebase بعد. عدّل الملف js/firebase-config.js ثم أعد التحميل.');
  if (!authReady || (hid && !store.state.ready)) return say('muted', 'جارٍ التحميل…');
  if (!user) return renderAuth(view);
  if (!hid) return renderGate(view, user);
  const name = location.hash.replace('#/', '');
  const key = Object.hasOwn(routes, name) ? name : 'home';
  routes[key](view, store.state);
  document.querySelectorAll('.nav a').forEach((a) =>
    a.hash === `#/${key}` ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
}

store.subscribeSync(({ pending, error }) => { syncEl.textContent = !hid ? '' : error ?? (pending ? '⏳ بانتظار المزامنة' : '☁️ متزامن'); });
window.addEventListener('hashchange', () => { render(); view.focus(); });
store.subscribe(render);

onAuth((u) => {
  stopUser(); stopUser = () => {};
  store.detach(); hid = null; user = u; authReady = true;
  render();
  if (!u) return;
  stopUser = watchUserDoc(u.uid, async (next) => {
    if (next === hid) return;
    store.detach(); hid = next;
    if (next) { try { store.attach(await connect(next, u.uid)); } catch (e) { toast(e.message, true); } }
    render();
  });
});
