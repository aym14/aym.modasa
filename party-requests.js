/* Secure Party request form and Admin request inbox. Data access is enforced by Supabase RLS/RPC. */
(function () {
  'use strict';
  var buttonId = 'aymPartyRequestButton', modalId = 'aymPartyRequestModal';
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }
  function addStyle() {
    if (document.getElementById('aymPartyRequestStyle')) return;
    var style = document.createElement('style'); style.id = 'aymPartyRequestStyle';
    style.textContent = '#'+buttonId+'{position:fixed;z-index:9990;right:20px;bottom:92px;border:0;border-radius:999px;background:#087f70;color:#fff;padding:13px 18px;font-weight:800;box-shadow:0 5px 18px #15372d33;cursor:pointer}#'+modalId+'{position:fixed;inset:0;z-index:10020;background:#10201f99;display:grid;place-items:center;padding:16px;font:15px system-ui,sans-serif;color:#24332f}#'+modalId+' .aympr-card{width:min(680px,100%);max-height:90vh;overflow:auto;background:#f7faf8;border-radius:18px;padding:20px;box-shadow:0 14px 50px #0004}#'+modalId+' h2{margin:0 0 14px;font-size:1.25rem}#'+modalId+' label{display:block;font-weight:700;margin:12px 0 5px}#'+modalId+' input,#'+modalId+' textarea,#'+modalId+' select{box-sizing:border-box;width:100%;padding:11px;border:1px solid #cbd8d1;border-radius:10px;background:white;font:inherit}#'+modalId+' textarea{min-height:125px;resize:vertical}#'+modalId+' .aympr-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}#'+modalId+' .aympr-actions button,#'+modalId+' .aympr-card-item button{border:0;border-radius:10px;padding:10px 14px;font-weight:750;cursor:pointer;background:#087f70;color:#fff}#'+modalId+' button.aympr-secondary{background:#e7eeea;color:#263b34}#'+modalId+' .aympr-error{color:#a33131;min-height:1.3em;margin-top:8px}#'+modalId+' .aympr-card-item{background:#fff;border:1px solid #dde7e1;border-radius:12px;padding:13px;margin:10px 0;overflow-wrap:anywhere}#'+modalId+' .aympr-meta{color:#5b6b64;font-size:.84rem;margin:5px 0}#'+modalId+' .aympr-message{white-space:pre-wrap;line-height:1.5;margin:8px 0}';
    document.head.appendChild(style);
  }
  function closeModal() { var old = document.getElementById(modalId); if (old) old.remove(); }
  function shell(title) {
    closeModal(); addStyle();
    var wrap = document.createElement('div'); wrap.id = modalId; wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-modal','true');
    wrap.innerHTML = '<section class="aympr-card"><h2>'+esc(title)+'</h2><div class="aympr-content"></div><div class="aympr-actions"><button type="button" class="aympr-secondary" data-close>બંધ કરો</button></div></section>';
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('[data-close]')) closeModal(); });
    document.body.appendChild(wrap); return wrap;
  }
  async function showPartyForm() {
    var wrap = shell('એડમિનને વિનંતી મોકલો'), content = wrap.querySelector('.aympr-content');
    content.innerHTML = '<p>આ ફોર્મ એડમિનને મોકલાશે. કૃપા કરીને જરૂરી માહિતી જ લખો.</p><label for="aymprSubject">વિષય</label><input id="aymprSubject" maxlength="120" required placeholder="જેમ કે: હિસાબ અંગે પૂછપરછ"><label for="aymprMessage">વિગતો</label><textarea id="aymprMessage" maxlength="4000" required placeholder="તમારી વિનંતી લખો"></textarea><div class="aympr-error" aria-live="polite"></div>';
    wrap.querySelector('.aympr-actions').insertAdjacentHTML('afterbegin','<button type="button" id="aymprSend">મોકલો</button>');
    wrap.querySelector('#aymprSend').onclick = async function () {
      var subject = wrap.querySelector('#aymprSubject').value.trim(), message = wrap.querySelector('#aymprMessage').value.trim(), error = wrap.querySelector('.aympr-error'), send = this;
      error.textContent = '';
      if (subject.length < 2 || message.length < 2) { error.textContent = 'વિષય અને વિગતો લખો.'; return; }
      send.disabled = true; send.textContent = 'મોકલાઈ રહ્યું છે…';
      try { await window.AYMPO.submitPartyRequest(subject,message); closeModal(); if (typeof window.showToast==='function') window.showToast('તમારી વિનંતી એડમિનને મોકલાઈ.'); }
      catch (e) { error.textContent = e.message || 'વિનંતી મોકલી શકાઈ નથી.'; send.disabled = false; send.textContent = 'મોકલો'; }
    };
  }
  async function showAdminInbox() {
    var wrap = shell('પાર્ટીની ઓનલાઇન વિનંતીઓ'), content = wrap.querySelector('.aympr-content'); content.textContent = 'લોડ થાય છે…';
    try {
      var rows = await window.AYMPO.listAdminPartyRequests(); content.replaceChildren();
      if (!rows.length) { content.textContent = 'હજુ કોઈ વિનંતી આવી નથી.'; return; }
      rows.forEach(function (r) {
        var card = document.createElement('article'); card.className = 'aympr-card-item';
        card.innerHTML = '<strong>'+esc(r.subject)+'</strong><div class="aympr-meta">'+esc(r.party_name)+' · '+esc(r.party_email)+' · '+esc(new Date(r.created_at).toLocaleString('gu-IN'))+'</div><div class="aympr-message">'+esc(r.message)+'</div><label>સ્થિતિ</label><select aria-label="વિનંતીની સ્થિતિ"><option value="new">નવી</option><option value="reviewing">ચાલુ</option><option value="resolved">પૂર્ણ</option></select><div class="aympr-error" aria-live="polite"></div><div class="aympr-actions"><button type="button">સ્થિતિ સાચવો</button></div>';
        var select = card.querySelector('select'), error = card.querySelector('.aympr-error'), save = card.querySelector('button'); select.value = r.status;
        save.onclick = async function () { save.disabled = true; error.textContent = ''; try { await window.AYMPO.updateAdminPartyRequest(r.id,select.value); error.style.color='#087f70'; error.textContent='સાચવ્યું'; } catch (e) { error.style.color=''; error.textContent=e.message||'સાચવી શકાયું નથી.'; } finally { save.disabled=false; } };
        content.appendChild(card);
      });
    } catch (e) { content.textContent = e.message || 'વિનંતીઓ લાવી શકાઈ નથી. Supabaseમાં migration લાગુ છે અને Admin જોડાયેલ છે તે તપાસો.'; }
  }
  function mount() {
    if (!window.AYMPO) return;
    var isParty = !!window.aymPartyReadOnlyCloud;
    var isAdmin = false; try { isAdmin = !!(window.isAdmin && window.isAdmin()); } catch (_) {}
    var button = document.getElementById(buttonId);
    if (!isParty && !isAdmin) { if (button) button.remove(); return; }
    if (!button) { button = document.createElement('button'); button.id = buttonId; button.type = 'button'; document.body.appendChild(button); }
    button.textContent = isParty ? '✉️ વિનંતી મોકલો' : '📥 પાર્ટી વિનંતીઓ';
    button.onclick = isParty ? showPartyForm : showAdminInbox;
  }
  setInterval(mount, 1000); document.addEventListener('DOMContentLoaded', mount);
})();

