/* Restore the local Admin login from the protected Supabase ledger snapshot. */
(function () {
  'use strict';

  var panelId = 'aymAdminRecoveryPanel';
  var buttonId = 'aymAdminRecoveryButton';

  function config() {
    try {
      if (typeof loadCloudConfig === 'function') return loadCloudConfig() || {};
      return JSON.parse(localStorage.getItem('fm_cloud_config_v1') || '{}') || {};
    } catch (_) { return {}; }
  }

  function save(value) {
    if (typeof saveCloudConfig !== 'function') throw new Error('Cloud settings are unavailable. Reload the page.');
    saveCloudConfig(value);
  }

  function explain(error) {
    var message = String(error && error.message || '');
    if (/failed to fetch|network|load failed/i.test(message)) return 'Supabase સાથે જોડાઈ શકાતું નથી. ઇન્ટરનેટ તપાસો.';
    return message || 'Admin account restore થઈ શક્યું નહીં.';
  }

  function addUi() {
    var login = document.getElementById('loginFormBlock');
    if (!login || document.getElementById(buttonId)) return;
    var button = document.createElement('button');
    button.id = buttonId;
    button.type = 'button';
    button.textContent = 'Admin login મળતું નથી? Email OTPથી account restore કરો';
    button.style.cssText = 'display:block;width:100%;margin:12px 0 0;padding:10px 12px;border:1px solid #b8d3cc;border-radius:10px;background:#f4faf7;color:#12685b;font:600 14px system-ui;cursor:pointer;white-space:normal';
    var submit = document.getElementById('loginSubmitBtn');
    if (submit && submit.parentNode === login) login.insertBefore(button, submit);
    else login.appendChild(button);
    button.addEventListener('click', openPanel);
  }

  function openPanel() {
    var existing = document.getElementById(panelId);
    if (existing) { existing.hidden = false; return; }
    var cfg = config();
    var panel = document.createElement('section');
    panel.id = panelId;
    panel.setAttribute('aria-label', 'Restore Admin account');
    panel.style.cssText = 'margin:12px 0;padding:14px;border:1px solid #cbded7;border-radius:12px;background:#f8fbf9;text-align:left;box-sizing:border-box;width:100%';
    panel.innerHTML = '<strong>Admin account restore</strong><p style="margin:6px 0 10px;font-size:13px;line-height:1.45">તમારા Supabase Admin email પર OTP મોકલી, અધિકાર ચકાસ્યા પછી આ device પર cloud account પાછું લાવશે.</p>' +
      '<label for="aymAdminRecoveryEmail" style="display:block;margin:8px 0 4px">Registered Admin email</label>' +
      '<input id="aymAdminRecoveryEmail" type="email" autocomplete="email" inputmode="email" maxlength="254" style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #bacbc4;border-radius:8px;font:inherit">' +
      '<div id="aymAdminRecoveryOtpWrap" hidden><label for="aymAdminRecoveryOtp" style="display:block;margin:8px 0 4px">Email OTP</label><input id="aymAdminRecoveryOtp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #bacbc4;border-radius:8px;font:inherit"></div>' +
      '<div id="aymAdminRecoveryStatus" role="status" aria-live="polite" style="min-height:1.4em;margin-top:8px;color:#8b2e2e;font-size:13px;overflow-wrap:anywhere"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button id="aymAdminRecoverySend" type="button">OTP મોકલો</button><button id="aymAdminRecoveryVerify" type="button" hidden>OTP ચકાસો અને accounts restore કરો</button><button id="aymAdminRecoveryClose" type="button">બંધ કરો</button></div>';
    var button = document.getElementById(buttonId);
    if (button && button.parentNode) button.parentNode.insertBefore(panel, button.nextSibling);
    else document.getElementById('loginFormBlock').appendChild(panel);
    var email = document.getElementById('aymAdminRecoveryEmail');
    email.value = String(cfg.supabaseAdminEmail || '').trim();
    document.getElementById('aymAdminRecoveryClose').addEventListener('click', function () { panel.remove(); });
    document.getElementById('aymAdminRecoverySend').addEventListener('click', sendOtp);
    document.getElementById('aymAdminRecoveryVerify').addEventListener('click', verifyOtp);
    email.focus();
  }

  function setStatus(message, isError) {
    var status = document.getElementById('aymAdminRecoveryStatus');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#8b2e2e' : '#17695b';
  }

  async function sendOtp() {
    var cfg = config();
    var email = String(document.getElementById('aymAdminRecoveryEmail').value || '').trim().toLowerCase();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      setStatus('Cloud configuration નથી. જૂના Admin deviceમાંથી વિશ્વાસપાત્ર Join QRથી આ device જોડો.', true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('નોંધાયેલ Admin email સાચું લખો.', true);
      return;
    }
    var send = document.getElementById('aymAdminRecoverySend');
    send.disabled = true;
    try {
      cfg.provider = 'supabase';
      cfg.supabaseAdminEmail = email;
      save(cfg);
      var response = await fetch(String(cfg.supabaseUrl).replace(/\/+$/, '') + '/auth/v1/otp', {
        method: 'POST',
        headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, create_user: false })
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.msg || result.message || 'Email OTP મોકલી શકાયો નહીં (' + response.status + ').');
      document.getElementById('aymAdminRecoveryOtpWrap').hidden = false;
      document.getElementById('aymAdminRecoveryVerify').hidden = false;
      setStatus('OTP મોકલ્યો. emailમાંથી code દાખલ કરો.', false);
      document.getElementById('aymAdminRecoveryOtp').focus();
    } catch (error) {
      setStatus(explain(error), true);
    } finally {
      send.disabled = false;
    }
  }

  async function verifyOtp() {
    var cfg = config();
    var email = String(document.getElementById('aymAdminRecoveryEmail').value || '').trim().toLowerCase();
    var otp = String(document.getElementById('aymAdminRecoveryOtp').value || '').replace(/\D/g, '');
    if (!/^\d{6,10}$/.test(otp)) { setStatus('Emailમાં આવેલો 6 થી 10 અંકનો OTP દાખલ કરો.', true); return; }
    var verify = document.getElementById('aymAdminRecoveryVerify');
    verify.disabled = true;
    try {
      var response = await fetch(String(cfg.supabaseUrl).replace(/\/+$/, '') + '/auth/v1/verify', {
        method: 'POST',
        headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, token: otp, type: 'email' })
      });
      var auth = await response.json().catch(function () { return {}; });
      if (!response.ok || !auth.access_token || !auth.user || !auth.user.id) throw new Error(auth.msg || auth.message || 'OTP ચકાસણી નિષ્ફળ. ફરી પ્રયાસ કરો.');
      if (String(auth.user.email || '').trim().toLowerCase() !== email) throw new Error('OTP ચકાસાયેલ email સાથે મેળ ખાતો નથી. ફરી પ્રયાસ કરો.');
      if (typeof supabaseSaveSession !== 'function' || typeof supabaseEnsureAdmin !== 'function' || typeof supabaseFetchRow !== 'function') {
        throw new Error('Admin cloud restore service ઉપલબ્ધ નથી. પેજ ફરી લોડ કરો.');
      }
      supabaseSaveSession(auth);
      var admin = await supabaseEnsureAdmin();
      cfg = config();
      cfg.provider = 'supabase';
      cfg.autoSync = true;
      cfg.supabaseAdminEmail = email;
      cfg.supabaseOrganizationId = admin.organizationId;
      cfg.supabaseTable = cfg.supabaseTable || 'aym_cloud_ledger_snapshots';
      save(cfg);
      var row = await supabaseFetchRow();
      if (!row || !row.data) throw new Error('Admin membership ચકાસાયું, પણ cloudમાં Ledger snapshot નથી. જૂના Admin deviceનું Cloud Sync તપાસો.');
      if (typeof window.aymLoginCloudPull !== 'function' || !await window.aymLoginCloudPull()) {
        throw new Error('Ledger snapshot મળ્યો, પણ આ device પર account restore ન થઈ શક્યું. જૂના Admin deviceનું Cloud Sync તપાસો.');
      }
      var usersList = typeof users !== 'undefined' && Array.isArray(users) ? users : [];
      if (!usersList.some(function (user) { return user && user.role === 'admin'; })) {
        throw new Error('Cloud data restore થયું, પણ તેમાં Admin login account નથી. જૂના Admin device પર sync ચલાવો.');
      }
      document.getElementById('aymAdminRecoveryOtp').value = '';
      setStatus('✅ Admin access અને login accounts restore થયા. હવે તમારું પહેલાંનું Admin username/password નાખીને Log in કરો.', false);
      var loginError = document.getElementById('loginError');
      if (loginError) loginError.textContent = '';
    } catch (error) {
      if (typeof supabaseClearSession === 'function') supabaseClearSession();
      setStatus(explain(error), true);
    } finally {
      verify.disabled = false;
    }
  }

  addUi();
  new MutationObserver(addUi).observe(document.body, { childList: true, subtree: true });
})();
