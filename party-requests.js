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
  function field(id,label,placeholder,type,optional){return '<label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" maxlength="240" '+(optional?'':'required ')+'placeholder="'+esc(placeholder||'')+'">';}
  async function showApplicationForm(type) {
    var isLoan=type==='loan_application', title=isLoan?'ઓનલાઇન લોન અરજી':'જામીનદાર ફેરફારની અરજી';
    var wrap=shell(title),content=wrap.querySelector('.aympr-content'), fields=isLoan
      ? field('aymfAmount','લોનની માંગેલી રકમ (₹)','ઉદાહરણ: 50000','number')+field('aymfPurpose','લોનનો હેતુ','લોન શા માટે જોઈએ છે?')+field('aymfAddress','સરનામું','તમારું હાલનું સરનામું')+field('aymfMobile','મોબાઇલ નંબર','10 અંકનો નંબર','tel')+field('aymfGuarantor1','જામીનદાર 1નું નામ','પૂર્ણ નામ')+field('aymfGuarantor2','જામીનદાર 2નું નામ (વૈકલ્પિક)','પૂર્ણ નામ','text',true)
      : field('aymfLoanRef','લોન/ખાતા નંબર અથવા ઓળખ','ઉદાહરણ: લોન નંબર')+field('aymfOldGuarantor','હાલના જામીનદારનું નામ','પૂર્ણ નામ')+field('aymfNewGuarantor','નવા જામીનદારનું નામ','પૂર્ણ નામ')+field('aymfNewMobile','નવા જામીનદારનો મોબાઇલ','10 અંકનો નંબર','tel')+field('aymfNewAddress','નવા જામીનદારનું સરનામું','હાલનું સરનામું')+field('aymfReason','બદલવાનું કારણ','કારણ લખો');
    content.innerHTML='<p>આ અરજી સુરક્ષિત રીતે એડમિનને મોકલાશે. એડમિનની મંજૂરી પછી જ ફેરફાર અમલમાં આવશે.</p>'+fields+'<label for="aymfNote">વધારાની નોંધ (વૈકલ્પિક)</label><textarea id="aymfNote" maxlength="2000" placeholder="જરૂરી વધારાની માહિતી"></textarea><div class="aympr-error" aria-live="polite"></div>';
    wrap.querySelector('.aympr-actions').insertAdjacentHTML('afterbegin','<button type="button" id="aymfSend">અરજી મોકલો</button>');
    wrap.querySelector('#aymfSend').onclick=async function(){
      var send=this,error=wrap.querySelector('.aympr-error');error.textContent='';
      var val=function(id){var el=wrap.querySelector('#'+id);return el?el.value.trim():'';};
      var missing=Array.from(wrap.querySelectorAll('[required]')).find(function(el){return !el.value.trim();});
      if(missing){error.textContent='કૃપા કરીને “'+(missing.previousElementSibling.textContent||'')+'” ભરો.';missing.focus();return;}
      var payload=isLoan?{amount:Number(val('aymfAmount')),purpose:val('aymfPurpose'),address:val('aymfAddress'),mobile:val('aymfMobile'),guarantors:[val('aymfGuarantor1'),val('aymfGuarantor2')].filter(Boolean),note:val('aymfNote')}
        :{loan_reference:val('aymfLoanRef'),old_guarantor:val('aymfOldGuarantor'),new_guarantor:val('aymfNewGuarantor'),new_guarantor_mobile:val('aymfNewMobile'),new_guarantor_address:val('aymfNewAddress'),reason:val('aymfReason'),note:val('aymfNote')};
      if(isLoan&&(!payload.amount||payload.amount<1||payload.amount>100000000)){error.textContent='માન્ય લોન રકમ લખો.';return;}
      if(!isLoan&&payload.old_guarantor.toLowerCase()===payload.new_guarantor.toLowerCase()){error.textContent='નવા જામીનદારનું નામ અલગ લખો.';return;}
      send.disabled=true;send.textContent='મોકલાઈ રહ્યું છે…';
      try{await window.AYMPO.submitPartyForm(type,payload);closeModal();if(typeof window.showToast==='function')window.showToast('✅ અરજી એડમિનને મોકલાઈ.');}
      catch(e){error.textContent=e.message||'અરજી મોકલી શકાઈ નથી.';send.disabled=false;send.textContent='અરજી મોકલો';}
    };
  }
  function showPartyFormMenu(){var wrap=shell('ઓનલાઇન ફોર્મ પસંદ કરો'),content=wrap.querySelector('.aympr-content');content.innerHTML='<p>તમારી અરજી એડમિનની સમીક્ષા માટે મોકલાશે.</p><div class="aympr-actions" style="justify-content:flex-start"><button type="button" data-form="loan_application">💰 લોન અરજી</button><button type="button" data-form="guarantor_change">🔁 જામીનદાર ફેરફાર</button></div><div class="aympr-error" aria-live="polite"></div>';content.querySelectorAll('[data-form]').forEach(function(b){b.onclick=function(){showApplicationForm(b.dataset.form);};});}
  // Cloud Party users use their task tiles for secured server-side forms.
  function openCloudTaskForm(type) {
    if (!window.aymPartyReadOnlyCloud) return false;
    var current = null;
    try { current = typeof window.CS === 'function' ? window.CS() : window.currentSession; } catch (_) {}
    if (!current || current.role !== 'party') return false;
    showApplicationForm(type);
    return true;
  }
  window.AYMPartyRequests = window.AYMPartyRequests || {};
  window.AYMPartyRequests.openCloudTaskForm = openCloudTaskForm;
  document.addEventListener('click', function (event) {
    if (!window.aymPartyReadOnlyCloud) return;
    var tile = event.target && event.target.closest ? event.target.closest('#nsPartyTasks [data-ns-task]') : null;
    if (!tile) return;
    var action = tile.getAttribute('data-ns-task');
    var type = action === 'loanForm' ? 'loan_application' : action === 'guarantorChange' ? 'guarantor_change' : '';
    if (!type) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    openCloudTaskForm(type);
  }, true);
  function restrictCloudPartyReportFilter() {
    if (!window.aymPartyReadOnlyCloud) return;
    var session = null;
    try { session = typeof window.CS === 'function' ? window.CS() : window.currentSession; } catch (_) {}
    if (!session || session.role !== 'party') return;
    var input = document.getElementById('reportPartySearch');
    var list = document.getElementById('reportPartyList');
    if (!input || !list) return;
    var ownName = String(session.name || '').trim();
    list.replaceChildren();
    if (ownName) {
      var option = document.createElement('option');
      option.value = ownName;
      list.appendChild(option);
    }
    input.value = ownName;
    input.readOnly = true;
    input.setAttribute('aria-label', 'ફક્ત તમારો પાર્ટી રિપોર્ટ');
    input.placeholder = ownName || 'તમારો પાર્ટી રિપોર્ટ';
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
  var formLabels={loan_application:'લોન અરજી',guarantor_change:'જામીનદાર ફેરફાર'},statusLabels={pending:'નવી',reviewing:'તપાસમાં',approved:'મંજૂર',rejected:'નામંજૂર'};
  async function showAdminForms(){
    var wrap=shell('પાર્ટીની લોન અને જામીનદાર અરજીઓ'),content=wrap.querySelector('.aympr-content');content.textContent='લોડ થાય છે…';
    try{var rows=await window.AYMPO.listAdminPartyForms();content.replaceChildren();if(!rows.length){content.textContent='હજુ કોઈ અરજી આવી નથી.';return;}
      rows.forEach(function(r){var details=r.payload||{},loan=r.form_type==='loan_application';var lines=loan?[
        ['માંગેલી રકમ','₹ '+Number(details.amount||0).toLocaleString('en-IN')],['હેતુ',details.purpose],['સરનામું',details.address],['મોબાઇલ',details.mobile],['જામીનદાર',Array.isArray(details.guarantors)?details.guarantors.join(', '):''],['નોંધ',details.note]
      ]:[['લોન/ખાતા',details.loan_reference],['હાલના જામીનદાર',details.old_guarantor],['નવા જામીનદાર',details.new_guarantor],['મોબાઇલ',details.new_guarantor_mobile],['સરનામું',details.new_guarantor_address],['કારણ',details.reason],['નોંધ',details.note]];
      var card=document.createElement('article');card.className='aympr-card-item';card.innerHTML='<strong>'+esc(formLabels[r.form_type]||r.form_type)+'</strong><div class="aympr-meta">'+esc(r.party_name)+' · '+esc(r.party_email)+' · '+esc(new Date(r.created_at).toLocaleString('gu-IN'))+'</div>'+lines.filter(function(x){return x[1]!==undefined&&x[1]!=='';}).map(function(x){return '<div class="aympr-message"><b>'+esc(x[0])+':</b> '+esc(x[1])+'</div>';}).join('')+'<label>અરજીની સ્થિતિ</label><select aria-label="અરજીની સ્થિતિ"><option value="pending">નવી</option><option value="reviewing">તપાસમાં</option><option value="approved">મંજૂર</option><option value="rejected">નામંજૂર</option></select><label>એડમિનની નોંધ</label><textarea maxlength="2000" placeholder="પાર્ટી માટે નોંધ">'+esc(r.admin_note||'')+'</textarea><div class="aympr-error" aria-live="polite"></div><div class="aympr-actions"><button type="button">સ્થિતિ સાચવો</button></div>';
      var select=card.querySelector('select'),note=card.querySelector('textarea'),error=card.querySelector('.aympr-error'),save=card.querySelector('button');select.value=r.status;
      save.onclick=async function(){save.disabled=true;error.textContent='';try{await window.AYMPO.updateAdminPartyForm(r.id,select.value,note.value);error.style.color='#087f70';error.textContent='સાચવ્યું';}catch(e){error.style.color='';error.textContent=e.message||'સાચવી શકાયું નથી.';}finally{save.disabled=false;}};content.appendChild(card);});
    }catch(e){content.textContent=e.message||'અરજીઓ લાવી શકાઈ નથી. Supabase migration અને Admin જોડાણ તપાસો.';}
  }
  function mount() {
    if (!window.AYMPO) return;
    // Remove the duplicate fixed launcher; the dashboard already has the form tasks.
    document.querySelectorAll('button,a,[role="button"]').forEach(function (el) {
      var label = String(el.innerText || el.getAttribute('aria-label') || '').trim();
      if (!/ઓનલાઇન\s*ફોર્મ|ઓનલાઈન\s*ફોર્મ/.test(label)) return;
      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);
      if ((style.position === 'fixed' || rect.right > window.innerWidth * 0.72) && rect.bottom > window.innerHeight * 0.58) el.remove();
    });
    var isParty = !!window.aymPartyReadOnlyCloud;
    var isAdmin = false; try { isAdmin = !!(window.isAdmin && window.isAdmin()); } catch (_) {}
    restrictCloudPartyReportFilter();
    if (isParty) {
      var partyButton = document.getElementById(buttonId);
      if (partyButton) partyButton.remove();
      var taskPanel = document.getElementById('nsPartyTasks');
      if (taskPanel) taskPanel.querySelectorAll('[data-ns-task="availableGuarantors"],[data-ns-task="messages"]').forEach(function (item) { item.remove(); });
      return;
    }
    var button = document.getElementById(buttonId);
    if (!isAdmin) { if (button) button.remove(); return; }
    if (!button) { button = document.createElement('button'); button.id = buttonId; button.type = 'button'; document.body.appendChild(button); }
    button.textContent = '📥 પાર્ટી અરજીઓ';
    button.onclick = async function(){var wrap=shell('પાર્ટી અરજીઓ'),content=wrap.querySelector('.aympr-content');content.innerHTML='<p>પાર્ટી તરફથી આવેલ અરજીઓ અને સામાન્ય વિનંતીઓ જુઓ.</p><div class="aympr-actions" style="justify-content:flex-start"><button type="button" data-open-forms>લોન / જામીન ફોર્મ</button><button type="button" class="aympr-secondary" data-open-requests>સામાન્ય વિનંતીઓ</button></div>';wrap.querySelector('[data-open-forms]').onclick=showAdminForms;wrap.querySelector('[data-open-requests]').onclick=showAdminInbox;};
  }
  setInterval(mount, 1000); document.addEventListener('DOMContentLoaded', mount);
})();
